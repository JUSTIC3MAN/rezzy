#!/usr/bin/env node
'use strict';

/* ════════════════════════════════════════════════════════════════════════════
   Pull the game across from the web project and prepare it for the iOS app.

   The web version in the parent folder stays the source of truth. This script
   copies it in, applies the changes the iOS app needs, and mirrors the result
   into the Xcode project. Run it after any edit to the web game:

       node sync-web-assets.mjs

   Three things differ from the browser build:

   1. Leaderboard URLs. On the web the game and the API share an origin, so
      fetch('/api/get-scores') resolves. In the app it does not — Capacitor
      serves the game from capacitor://localhost, so that path would ask the
      app for its own bundled files. Every API call gets prefixed with
      window.REZZY_API_BASE, which config.js sets.

   2. Video. The backgrounds are VP9-in-WebM with an Opus track. iOS support
      for that combination depends on the iOS version and decodes in software
      on most iPhones — a battery and framerate cost for a video that loops
      forever. They are transcoded to H.264 MP4, which every iPhone ever
      shipped decodes in hardware. The audio is dropped: the element is muted.

   3. The notch, the home indicator and the long-press magnifier. ios-tweaks.css
      keeps the trophy button clear of the insets; ios-tweaks.js lifts the name
      modal above the keyboard when it opens.

   All patches are idempotent: running twice is harmless. Transcodes are cached
   in .video-cache/, so only a changed source video is re-encoded.
   ════════════════════════════════════════════════════════════════════════════ */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE  = dirname(fileURLToPath(import.meta.url));
const WEB   = resolve(HERE, '..');
const WWW   = join(HERE, 'www');
const CACHE = join(HERE, '.video-cache');
const NATIVE_ASSETS = join(HERE, 'ios', 'App', 'App', 'public');

const API_BASE = 'https://acalan-rezzy.vercel.app';

const FILES = ['index.html', 'game.js', 'style.css'];
const DIRS  = ['RezzySpriteSheet', 'Items', 'font'];   // backgroundloop is handled separately
const VIDEO_DIR = 'backgroundloop';

function die(msg) {
    console.error('\n  ✗ ' + msg + '\n');
    process.exit(1);
}

/* Clear a generated folder before refilling it, so a file deleted from the web
   project doesn't linger in the build. Some environments refuse the unlink —
   a locked-down shell, or a file held open by Xcode or a video player. That is
   not fatal: everything is overwritten in place either way, and only a file
   that no longer exists upstream would survive. */
/* Copy by truncate-and-write rather than fs.cpSync, which unlinks an existing
   destination first — that fails wherever deletes are restricted or the file is
   held open, and there is no reason a rebuild should need to remove anything. */
function copyFile(src, dest) {
    writeFileSync(dest, readFileSync(src));
}

function copyTree(src, dest) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src, { withFileTypes: true })) {
        const from = join(src, entry.name);
        const to = join(dest, entry.name);
        if (entry.isDirectory()) copyTree(from, to);
        else copyFile(from, to);
    }
}

function cleanDir(dir) {
    try {
        rmSync(dir, { recursive: true, force: true });
    } catch (e) {
        console.warn(`  ! could not clear ${dir} (${e.code}) — overwriting in place instead`);
    }
    mkdirSync(dir, { recursive: true });
}

// ── Sanity: are we actually next to the web game? ───────────────────────────
for (const f of FILES) {
    if (!existsSync(join(WEB, f))) {
        die(`Could not find ${f} in ${WEB}\n    This folder must sit directly inside the web project.`);
    }
}

// ── Copy ────────────────────────────────────────────────────────────────────
cleanDir(WWW);

for (const f of FILES) copyFile(join(WEB, f), join(WWW, f));
for (const d of DIRS) {
    if (existsSync(join(WEB, d))) copyTree(join(WEB, d), join(WWW, d));
    else console.warn(`  ! ${d}/ not found in the web project, skipping`);
}
console.log('  ✓ copied the game from ' + WEB);

// ── Video: VP9/WebM → H.264/MP4 ─────────────────────────────────────────────
const videos = [];
{
    const srcDir = join(WEB, VIDEO_DIR);
    const outDir = join(WWW, VIDEO_DIR);
    mkdirSync(outDir, { recursive: true });
    mkdirSync(CACHE, { recursive: true });

    const haveFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
    if (!existsSync(srcDir)) {
        console.warn(`  ! ${VIDEO_DIR}/ not found in the web project, skipping`);
    } else {
        for (const name of readdirSync(srcDir).filter(n => n.endsWith('.webm'))) {
            const src = join(srcDir, name);
            const mp4 = name.replace(/\.webm$/, '.mp4');
            const cached = join(CACHE, mp4);
            videos.push({ webm: name, mp4 });

            if (!haveFfmpeg) {
                copyFile(src, join(outDir, name));
                continue;
            }

            const fresh = existsSync(cached) && statSync(cached).mtimeMs >= statSync(src).mtimeMs;
            if (!fresh) {
                process.stdout.write(`  · encoding ${name} → ${mp4} ... `);
                try {
                    execFileSync('ffmpeg', [
                        '-y', '-loglevel', 'error', '-i', src,
                        // Baseline-friendly H.264. yuv420p and the even-dimension
                        // filter are both required: VideoToolbox refuses odd sizes
                        // and anything but 4:2:0 chroma.
                        '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-crf', '21', '-preset', 'slow',
                        // The element is muted, so the Opus track is dead weight.
                        '-an',
                        // Moves the index to the front so playback can start
                        // before the whole file is read.
                        '-movflags', '+faststart',
                        cached
                    ], { stdio: ['ignore', 'ignore', 'pipe'] });
                    console.log('done');
                } catch (e) {
                    die(`ffmpeg failed on ${name}\n    ${String(e.stderr || e.message).trim()}`);
                }
            }
            copyFile(cached, join(outDir, mp4));
        }
        if (!haveFfmpeg) {
            console.warn('  ! ffmpeg not found — shipped the .webm files unchanged.');
            console.warn('    The backgrounds may not play on iOS. Install ffmpeg and re-run.');
            videos.length = 0;
        } else {
            console.log(`  ✓ ${videos.length} background videos are H.264 MP4`);
        }
    }
}

// ── config.js: where the leaderboard lives ──────────────────────────────────
writeFileSync(join(WWW, 'config.js'),
`'use strict';

/* Where the leaderboard lives.

   Generated by sync-web-assets.mjs — edit API_BASE in that script, not here,
   or your change will be overwritten on the next sync. */

window.REZZY_API_BASE = ${JSON.stringify(API_BASE)};
`);
console.log('  ✓ wrote config.js  ->  ' + API_BASE);

// ── Patch game.js ───────────────────────────────────────────────────────────
{
    const p = join(WWW, 'game.js');
    let s = readFileSync(p, 'utf8');

    if (s.includes('const API_BASE')) {
        console.log('  · game.js already carries API_BASE, leaving it alone');
    } else {
        const edits = [
            ["'use strict';\n",
             "'use strict';\n\n" +
             "// Prefix for leaderboard calls. Empty in the browser, where the API is\n" +
             "// same-origin; set by config.js in the iOS app, where the game is served\n" +
             "// from capacitor://localhost and a bare '/api/...' would go nowhere.\n" +
             "const API_BASE = (typeof window !== 'undefined' && window.REZZY_API_BASE) || '';\n"],
            ["await fetch('/api/submit-score', {",
             "await fetch(API_BASE + '/api/submit-score', {"],
            ["const url = fresh ? '/api/get-scores?t=' + Date.now() : '/api/get-scores';",
             "const url = API_BASE + (fresh ? '/api/get-scores?t=' + Date.now() : '/api/get-scores');"],
        ];
        for (const [from, to] of edits) {
            const n = s.split(from).length - 1;
            if (n !== 1) {
                die(`game.js: expected exactly one match for\n      ${from.trim().slice(0, 70)}\n    but found ${n}.` +
                    `\n    The web game changed shape — update the edits in sync-web-assets.mjs.`);
            }
            s = s.replace(from, to);
        }
        writeFileSync(p, s);
        console.log('  ✓ patched game.js to use API_BASE');
    }

    // Video paths. Done separately from the block above so it still applies
    // when a previous run already inserted API_BASE.
    if (videos.length) {
        s = readFileSync(p, 'utf8');
        let hits = 0;
        for (const v of videos) {
            const n = s.split(v.webm).length - 1;
            hits += n;
            s = s.split(v.webm).join(v.mp4);
        }
        if (hits) {
            writeFileSync(p, s);
            console.log(`  ✓ game.js now points at the MP4s (${hits} references)`);
        } else {
            console.log('  · game.js already points at the MP4s');
        }
    }
}

// ── Patch index.html ────────────────────────────────────────────────────────
{
    const p = join(WWW, 'index.html');
    let h = readFileSync(p, 'utf8');
    let changed = false;

    // The <source> tag and its MIME type.
    if (videos.length) {
        for (const v of videos) {
            if (h.includes(v.webm)) { h = h.split(v.webm).join(v.mp4); changed = true; }
        }
        if (h.includes('type="video/webm"')) {
            h = h.split('type="video/webm"').join('type="video/mp4"');
            changed = true;
        }
    }

    // ios-tweaks.css, after the game's own stylesheet so it wins.
    if (!h.includes('ios-tweaks.css')) {
        const m = h.match(/[ \t]*<link rel="stylesheet" href="style\.css[^"]*">/);
        if (!m) die('index.html: could not find the style.css link tag.');
        h = h.replace(m[0], m[0] + '\n    <link rel="stylesheet" href="ios-tweaks.css">');
        changed = true;
    }

    // config.js before game.js; ios-tweaks.js after it, since it reaches for
    // elements the game has already wired up.
    if (!h.includes('config.js')) {
        const m = h.match(/[ \t]*<script src="game\.js[^"]*"><\/script>/);
        if (!m) die('index.html: could not find the game.js script tag.');
        h = h.replace(m[0], '    <script src="config.js"></script>\n' + m[0] +
                            '\n    <script src="ios-tweaks.js"></script>');
        changed = true;
    }

    if (changed) { writeFileSync(p, h); console.log('  ✓ patched index.html'); }
    else console.log('  · index.html already patched');
}

// ── ios-tweaks.css ──────────────────────────────────────────────────────────
writeFileSync(join(WWW, 'ios-tweaks.css'),
`/* iOS-only adjustments. Generated by sync-web-assets.mjs — don't edit here.

   Loaded after style.css so these win. Nothing in this file exists in the web
   version; it covers hardware the browser build never has to think about. */

/* Long-press on a canvas or a button otherwise raises the callout menu and the
   text magnifier, both of which land mid-gesture during normal play. */
* {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}

/* The one thing that does need selecting. */
#player-name {
    -webkit-user-select: text;
    user-select: text;
}

/* Keep the trophy clear of the Dynamic Island and the rounded corners. The
   game box is letterboxed inside the safe area on most iPhones already, so
   these usually resolve to the original 20px — they matter on the models
   where it doesn't. */
#trophy-btn {
    top: max(20px, env(safe-area-inset-top));
    right: max(20px, env(safe-area-inset-right));
}

/* Landscape keyboards eat about half the screen. ios-tweaks.js measures what's
   actually left and sets this; the transform keeps the modal centred in the
   visible strip instead of behind the keys. */
#name-modal .modal-content {
    transform: translateY(var(--kb-lift, 0px));
    transition: transform 0.18s ease-out;
    max-height: var(--kb-visible, 100vh);
    overflow-y: auto;
}

/* Home indicator sits over the bottom edge of the screen. Nothing interactive
   lives down there, but the modal buttons can get close on short screens. */
.modal-buttons {
    padding-bottom: env(safe-area-inset-bottom);
}
`);

// ── ios-tweaks.js ───────────────────────────────────────────────────────────
writeFileSync(join(WWW, 'ios-tweaks.js'),
`'use strict';

/* iOS-only adjustments. Generated by sync-web-assets.mjs — don't edit here.

   One job: when the keyboard opens for the name entry, iOS shrinks the visual
   viewport but leaves the layout viewport alone, so a centred modal stays put
   and the input ends up behind the keys. visualViewport reports the strip
   that's actually visible; the modal is moved into it. */

(function () {
    var vv = window.visualViewport;
    if (!vv) return;

    var modal = document.getElementById('name-modal');
    var input = document.getElementById('player-name');
    if (!modal || !input) return;

    var root = document.documentElement;

    function apply() {
        // Nothing to do unless the modal is up and the keyboard is taking room.
        var open = getComputedStyle(modal).display !== 'none';
        var covered = window.innerHeight - vv.height;

        if (!open || covered < 60) {
            root.style.setProperty('--kb-lift', '0px');
            root.style.removeProperty('--kb-visible');
            return;
        }

        // The modal is centred in the layout viewport. Move it up by half of
        // what the keyboard covers to re-centre it in what's left.
        root.style.setProperty('--kb-lift', '-' + Math.round(covered / 2) + 'px');
        root.style.setProperty('--kb-visible', Math.round(vv.height - 24) + 'px');
    }

    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    input.addEventListener('focus', function () { setTimeout(apply, 120); });
    input.addEventListener('blur', function () { setTimeout(apply, 120); });
})();
`);
console.log('  ✓ wrote ios-tweaks.css and ios-tweaks.js');

// ── Mirror into the Xcode project ───────────────────────────────────────────
/* Handed to the Capacitor CLI rather than copied by hand. Alongside the game it
   writes cordova.js and cordova_plugins.js into the same folder — the app's
   bridge loads both at startup, and a hand-rolled copy would quietly leave
   them out on the first clean rebuild. */
if (!existsSync(join(HERE, 'ios', 'App'))) {
    console.log('  · no ios/App/ folder yet — run "npx cap add ios" first');
} else {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const r = spawnSync(npx, ['cap', 'copy', 'ios'], { cwd: HERE, encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) {
        console.log('  ✓ copied into ios/App/App/public via the Capacitor CLI');
    } else {
        console.warn('  ! "npx cap copy ios" failed — falling back to a plain copy.');
        console.warn('    ' + String(r.stderr || r.error || '').trim().split('\n').slice(-2).join(' '));
        copyTree(WWW, NATIVE_ASSETS);
        console.warn('    Copied the game across, but cordova.js and cordova_plugins.js');
        console.warn('    are the CLI\'s to write. If the app opens to a blank screen,');
        console.warn('    run "npx cap sync ios" before building.');
    }
}

console.log('\n  Done.\n');
