import { addScore, bumpCounter, getStore, storeConfig } from '../lib/leaderboard-store.js';
import { applyCors } from '../lib/cors.js';

const LEADERBOARD_KEY = 'leaderboard';
const MAX_NAME_LENGTH = 7;
const MAX_SCORE = 100000;      // far above any real streak; blocks junk values
const KEEP_TOP = 200;          // trim the sorted set so it can't grow forever
const RATE_LIMIT_PER_MIN = 10;

/** Strip control characters and markup-significant characters, then truncate. */
function sanitizeName(raw) {
    return Array.from(raw)
        // Drop control characters and markup delimiters. Written as an explicit
        // code-point test rather than a regex range so no raw control bytes end
        // up living in the source file.
        .filter(ch => ch.codePointAt(0) >= 32 && ch !== '<' && ch !== '>')
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, MAX_NAME_LENGTH);
}

function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}

/** Fixed-window counter. Cheap, and good enough to stop casual flooding. */
async function isRateLimited(store, ip) {
    const key = `rl:submit:${ip}:${Math.floor(Date.now() / 60000)}`;
    return (await bumpCounter(store, key, 120)) > RATE_LIMIT_PER_MIN;
}

export default async function handler(req, res) {
    // A JSON POST from another origin triggers a preflight; answer it
    // before the method check rejects OPTIONS.
    if (applyCors(req, res, 'POST')) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let store;
    try {
        store = await getStore();
    } catch (error) {
        console.error('Leaderboard store init failed:', error);
        return res.status(503).json({ error: 'Leaderboard unavailable' });
    }

    if (!store) {
        console.error('Leaderboard not configured:', storeConfig().reason);
        return res.status(503).json({ error: 'Leaderboard unavailable' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { name, score } = body;

        if (typeof name !== 'string') {
            return res.status(400).json({ error: 'Name is required' });
        }
        const cleanName = sanitizeName(name);
        if (cleanName.length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Reject non-integers, negatives, NaN/Infinity and absurd values.
        if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
            return res.status(400).json({ error: 'Valid score is required' });
        }

        if (await isRateLimited(store, clientIp(req))) {
            return res.status(429).json({ error: 'Too many submissions, slow down' });
        }

        const member = JSON.stringify({
            name: cleanName,
            score,
            timestamp: Date.now(),
        });

        await addScore(store, LEADERBOARD_KEY, score, member, KEEP_TOP);

        return res.status(200).json({ success: true, message: 'Score submitted successfully' });
    } catch (error) {
        console.error('Error submitting score:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
