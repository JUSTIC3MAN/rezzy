/*
 * Cross-origin headers for the leaderboard endpoints.
 *
 * On the web the game and the API share an origin, so none of this matters.
 * The Android app is different: Capacitor serves the game from
 * https://localhost, so every leaderboard call is cross-origin and the WebView
 * blocks it outright unless the server says otherwise.
 *
 * Allowing any origin is not a loosening here. The leaderboard is already
 * public and unauthenticated — anyone who can open the game can read and write
 * it — so "*" grants no capability that a plain HTTP client did not already
 * have. What it does grant is the app the ability to work at all.
 *
 * Returns true when the request was a preflight and has already been answered,
 * in which case the handler must return immediately.
 */
export function applyCors(req, res, methods) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Let browsers skip the preflight for a day.
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }
    return false;
}
