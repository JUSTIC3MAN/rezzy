import { getStore, storeConfig, topMembers } from '../lib/leaderboard-store.js';
import { applyCors } from '../lib/cors.js';

const LEADERBOARD_KEY = 'leaderboard';
const TOP_N = 10;

export default async function handler(req, res) {
    // Answer the preflight before the method check rejects OPTIONS.
    if (applyCors(req, res, 'GET')) return;

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
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
        // Name the missing piece in the logs — an unconfigured store and an
        // unreachable one are indistinguishable from outside otherwise.
        console.error('Leaderboard not configured:', storeConfig().reason);
        return res.status(503).json({ error: 'Leaderboard unavailable' });
    }

    try {
        const raw = await topMembers(store, LEADERBOARD_KEY, TOP_N);

        // Only surface what the UI renders; timestamps stay server-side.
        const scores = [];
        for (const member of raw) {
            try {
                const entry = typeof member === 'string' ? JSON.parse(member) : member;
                if (entry && typeof entry.name === 'string' && Number.isFinite(entry.score)) {
                    scores.push({ name: entry.name, score: entry.score });
                }
            } catch {
                // Skip malformed rows rather than failing the whole request.
            }
        }

        // The leaderboard changes rarely; let the edge absorb repeat traffic.
        res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
        return res.status(200).json({ success: true, scores });
    } catch (error) {
        console.error('Error fetching scores:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
