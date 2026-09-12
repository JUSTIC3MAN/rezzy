// Minimal static file server for local preview of the game.
// Not used in production — Vercel serves these files directly.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 4321;
const SHOT_DIR = process.env.SHOT_DIR || __dirname;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.ttf': 'font/ttf',
    '.json': 'application/json',
};

// ── Local /api support ──────────────────────────────────────────────────────
// In production Vercel runs the functions in api/ for us. Locally nothing did,
// so the leaderboard 404'd and could never be tested without deploying.
//
// Rather than reimplement the endpoints (two copies of the rules would drift),
// this runs the real handlers from api/. They resolve their backend through
// lib/leaderboard-store.js, which returns globalThis.__rezzyStore if something
// already put one there — so seeding that slot with an in-memory stand-in makes
// the real handlers run against RAM, unchanged. Set REDIS_URL (or the REST
// pair) in the environment to exercise a real store instead.
const API_ROUTES = {
    '/api/get-scores': '../api/get-scores.js',
    '/api/submit-score': '../api/submit-score.js',
};

/** The two operations the shared store exposes, backed by plain objects. */
function memoryStore() {
    const zsets = new Map();      // key -> Map(member -> score)
    const counters = new Map();   // key -> integer

    const run = async ([name, ...args]) => {
        const op = String(name).toUpperCase();
        const key = String(args[0]);

        if (op === 'ZADD') {
            if (!zsets.has(key)) zsets.set(key, new Map());
            zsets.get(key).set(String(args[2]), Number(args[1]));
            return 1;
        }
        if (op === 'ZREMRANGEBYRANK') {
            const members = zsets.get(key);
            const stop = Number(args[2]);
            if (!members || stop >= 0) return 0;
            const keep = -stop - 1;
            const ascending = [...members.entries()].sort((a, b) => a[1] - b[1]);
            const doomed = ascending.slice(0, Math.max(0, ascending.length - keep));
            doomed.forEach(([member]) => members.delete(member));
            return doomed.length;
        }
        if (op === 'ZREVRANGE') {
            const members = [...(zsets.get(key) || new Map()).entries()].sort((a, b) => b[1] - a[1]);
            return members.slice(Number(args[1]), Number(args[2]) + 1).map(([member]) => member);
        }
        if (op === 'INCR') {
            const next = (counters.get(key) || 0) + 1;
            counters.set(key, next);
            return next;
        }
        if (op === 'EXPIRE') {
            const timer = setTimeout(() => counters.delete(key), Number(args[1]) * 1000);
            if (timer.unref) timer.unref();
            return 1;
        }
        throw new Error('memoryStore: unsupported command ' + op);
    };

    return {
        kind: 'memory',
        command: run,
        pipeline: async commands => {
            const results = [];
            for (const c of commands) results.push(await run(c));
            return results;
        },
    };
}

const hasCreds = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REDIS_URL', 'KV_URL']
    .some(name => process.env[name]);

if (!hasCreds) {
    globalThis.__rezzyStore = memoryStore();
    console.log('leaderboard: in-memory (set REDIS_URL or KV_REST_API_URL/_TOKEN for a real store)');
} else {
    console.log('leaderboard: using the configured store from the environment');
}

/** Present a Node response as the { status, json, setHeader } shape Vercel gives. */
function asVercelRes(res) {
    let code = 200;
    const shim = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(next) { code = next; return shim; },
        json(payload) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.writeHead(code);
            res.end(JSON.stringify(payload));
            return shim;
        },
    };
    return shim;
}

/** Vercel hands the handler a parsed body; the raw stream doesn't. */
function readJsonBody(req) {
    return new Promise(resolve => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve(undefined);
            try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); }
        });
        req.on('error', () => resolve(undefined));
    });
}

async function handleApi(req, res, modulePath) {
    try {
        const mod = await import(modulePath);   // handlers are ESM; this file is CJS
        req.body = req.method === 'POST' ? await readJsonBody(req) : undefined;
        await mod.default(req, asVercelRes(res));
    } catch (err) {
        console.error('local api error:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
}

http.createServer((req, res) => {
    // Dev-only sink: the page POSTs a canvas dataURL here so it can be viewed
    // as a real file. Local preview server only.
    if (req.method === 'POST' && req.url.startsWith('/__shot')) {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const b64 = body.replace(/^data:image\/png;base64,/, '');
            const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot')
                .replace(/[^a-z0-9_-]/gi, '');
            const out = path.join(SHOT_DIR, `${name}.png`);
            fs.writeFileSync(out, Buffer.from(b64, 'base64'));
            console.log('saved', out, fs.statSync(out).size, 'bytes');
            res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
        });
        return;
    }

    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    if (Object.prototype.hasOwnProperty.call(API_ROUTES, urlPath)) {
        handleApi(req, res, API_ROUTES[urlPath]);
        return;
    }

    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.join(ROOT, rel);

    // Keep traversal inside the project root.
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + rel);
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`static server on http://localhost:${PORT}`);
});
