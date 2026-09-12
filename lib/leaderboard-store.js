/**
 * Leaderboard storage, decoupled from any one Redis vendor.
 *
 * Vercel KV was retired in December 2024 and existing stores were moved to
 * Upstash. Depending on how a store is provisioned today, a project ends up
 * with EITHER a TCP connection string (REDIS_URL) or a pair of REST
 * credentials (KV_REST_API_URL / UPSTASH_REDIS_REST_URL plus a token) — and a
 * handler wired to only one of those silently 503s or 500s when it gets the
 * other. So detect whichever is present and speak that dialect.
 *
 * REST is preferred when both exist: it is a stateless HTTPS call, which suits
 * short-lived serverless invocations far better than a pooled TCP socket that
 * has to reconnect on every cold start.
 */

const REST_URL_VARS = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'];
const REST_TOKEN_VARS = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'];
const TCP_URL_VARS = ['REDIS_URL', 'KV_URL', 'UPSTASH_REDIS_URL', 'REDIS_TLS_URL'];

const firstSet = names => {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim() !== '') return { name, value: value.trim() };
    }
    return null;
};

/* ── REST backend (Upstash HTTP API) ──────────────────────────────────────── */

function restStore(baseUrl, token) {
    const root = baseUrl.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    async function call(path, body) {
        const res = await fetch(root + path, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            // Never let a hung upstream hold the whole function open.
            signal: AbortSignal.timeout(5000),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`Upstash REST ${res.status}: ${text.slice(0, 200)}`);
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { throw new Error(`Upstash REST returned non-JSON: ${text.slice(0, 200)}`); }
        return parsed;
    }

    const unwrap = one => {
        if (one && one.error) throw new Error(`Upstash REST: ${one.error}`);
        return one ? one.result : null;
    };

    return {
        kind: 'rest',
        async command(args) {
            return unwrap(await call('', args.map(String)));
        },
        async pipeline(commands) {
            const out = await call('/pipeline', commands.map(c => c.map(String)));
            return (Array.isArray(out) ? out : [out]).map(unwrap);
        },
    };
}

/* ── TCP backend (ioredis) ────────────────────────────────────────────────── */

async function tcpStore(url) {
    // Imported lazily so a REST-only deployment never needs ioredis installed.
    const { default: Redis } = await import('ioredis');

    // One client per warm container. A client per request opens a new TCP/TLS
    // connection each time and exhausts the connection limit under real traffic.
    if (!globalThis.__rezzyRedis) {
        globalThis.__rezzyRedis = new Redis(url, {
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            enableReadyCheck: true,
            lazyConnect: false,
        });
        globalThis.__rezzyRedis.on('error', err => {
            console.error('Redis connection error:', err.message);
        });
    }
    const client = globalThis.__rezzyRedis;

    return {
        kind: 'tcp',
        async command(args) {
            const [name, ...rest] = args;
            return client.call(name, ...rest.map(String));
        },
        async pipeline(commands) {
            let chain = client.multi();
            for (const [name, ...rest] of commands) chain = chain.call(name, ...rest.map(String));
            const replies = await chain.exec();
            return (replies || []).map(([err, value]) => { if (err) throw err; return value; });
        },
    };
}

/* ── Public surface ───────────────────────────────────────────────────────── */

/** Describes what is configured, so a handler can report *why* it can't serve. */
export function storeConfig() {
    const restUrl = firstSet(REST_URL_VARS);
    const restToken = firstSet(REST_TOKEN_VARS);
    const tcpUrl = firstSet(TCP_URL_VARS);
    if (restUrl && restToken) return { mode: 'rest', via: `${restUrl.name} + ${restToken.name}`, restUrl, restToken };
    if (tcpUrl) return { mode: 'tcp', via: tcpUrl.name, tcpUrl };
    if (restUrl || restToken) {
        const missing = restUrl ? REST_TOKEN_VARS.join(' or ') : REST_URL_VARS.join(' or ');
        return { mode: 'none', reason: `REST credentials are incomplete — missing ${missing}` };
    }
    return { mode: 'none', reason: 'no Redis credentials found' };
}

/**
 * A store, or null when nothing is configured. Tests may pre-seed
 * globalThis.__rezzyStore to run the real handlers against a stand-in.
 */
export async function getStore() {
    if (globalThis.__rezzyStore) return globalThis.__rezzyStore;

    const config = storeConfig();
    if (config.mode === 'none') return null;

    const store = config.mode === 'rest'
        ? restStore(config.restUrl.value, config.restToken.value)
        : await tcpStore(config.tcpUrl.value);

    globalThis.__rezzyStore = store;
    return store;
}

/** Add a score and trim the set to the top `keepTop` in one round trip. */
export async function addScore(store, key, score, member, keepTop) {
    await store.pipeline([
        ['ZADD', key, score, member],
        ['ZREMRANGEBYRANK', key, 0, -(keepTop + 1)],
    ]);
}

/** Highest `limit` members, best first. */
export async function topMembers(store, key, limit) {
    const rows = await store.command(['ZREVRANGE', key, 0, limit - 1]);
    return Array.isArray(rows) ? rows : [];
}

/** Fixed-window counter; returns the count within the current window. */
export async function bumpCounter(store, key, ttlSeconds) {
    const count = Number(await store.command(['INCR', key]));
    if (count === 1) await store.command(['EXPIRE', key, ttlSeconds]);
    return count;
}
