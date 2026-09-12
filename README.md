# Rezzy

A browser game — serve the right potion, keep the streak alive. Customers turn
up with an order, Rezzy has to hand over the right one, and the levels keep
coming: ten orders each for the first three, fifteen from there on, with
cutscenes through the opening levels. It ships three ways from this one repo: as
a website, as an **Android app**, and as an iOS app. The web version is the
source of truth; both native apps wrap it with
[Capacitor](https://capacitorjs.com) and are rebuilt from it by a sync script.

Live at <https://acalan-rezzy.vercel.app>

---

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `game.js`, `style.css` | The game. Plain HTML/canvas/JS — no framework, no build step. |
| `Items/`, `RezzySpriteSheet/`, `backgroundloop/`, `font/` | Sprites, cutscene and background video, the Bangers typeface. |
| `api/` | Two Vercel serverless functions: `get-scores` and `submit-score`. |
| `lib/` | Shared by both endpoints — the Redis-backed leaderboard store and the CORS helper. |
| **`android/`** | **The Android app. See below.** |
| `ios/` | The iOS app — same idea, built on a cloud Mac via Codemagic. |
| `.claude/serve-static.js` | Local dev server. Runs the real `api/` handlers against an in-memory store. |

Not in the repo, by design: `node_modules/`, the generated `www/` and
`assets/public/` folders inside each native project, the iOS `.video-cache/`,
and every `.env*` file.

---

## 📱 The Android app — `android/`

**This is the Android build.** Everything Android lives under `android/` and
nothing outside that folder is Android-specific, apart from the CORS helper in
`lib/cors.js` that the app needs in order to reach the leaderboard.

| | |
|---|---|
| App name | RezMe |
| Package ID | `com.rezme.game` — fixed once published |
| Orientation | Landscape, locked in the manifest |
| Min / target Android | 6.0 (API 23) / Android 15 (API 35) |
| Capacitor | 7.x |
| Leaderboard | Calls `https://acalan-rezzy.vercel.app` over the network |

The game's files are bundled **inside** the app, so it launches instantly and
plays offline. Only the leaderboard touches the network.

### Build it

```
cd android
npm ci
node sync-web-assets.mjs
```

Then open the **`android/android`** folder — the inner one — in Android Studio
and press Run. Full instructions, including signing and the Play Store
checklist, are in **[`android/README.md`](android/README.md)**.

### Status, honestly

The project is complete and verified by inspection, but **no APK has been
compiled and it has not yet run on a physical device.** The machine it was
assembled on has no route to `dl.google.com` or `maven.google.com`, so Gradle
could never resolve a dependency there. The compile happens on your machine.

---

## 🍎 The iOS app — `ios/`

Same structure, same sync script, different toolchain. It builds on a cloud Mac
through Codemagic (`ios/codemagic.yaml`) rather than locally, because building
for iOS requires macOS.

The one real difference from Android: its sync script transcodes the background
videos from VP9/WebM to H.264 MP4. iPhones that play VP9 at all mostly decode it
in software, which costs CPU and battery on a video that loops the whole time the
game is open; H.264 goes through dedicated hardware on every iPhone. Android
ships the WebM files unchanged. Details in [`ios/README.md`](ios/README.md).

---

## Running the web game locally

No build step. You do need a server rather than opening `index.html` from disk,
because the game fetches assets and calls `/api/`.

```
npm install
node .claude/serve-static.js
```

Then open <http://localhost:4321>.

That server runs the real handlers from `api/` — not reimplementations — against
an in-memory leaderboard, so scores submit and come back without a Redis
instance. Set `REDIS_URL` in the environment to point it at a real store
instead.

## Deploying

```
npx vercel --prod
```

Deploys by CLI upload from this folder, not from a GitHub push. `.vercelignore`
keeps `android/`, `ios/`, `waste/` and the Markdown out of the upload — without
those lines a deploy pushes well over 100 MB of Xcode and Gradle project.

The leaderboard needs `REDIS_URL` set in the Vercel project's environment
variables. Without it the endpoints return 503 and the game still plays; only
the score list goes quiet.

---

## Changing the game

Edit the web version at the repo root. Then, for each native app you care about:

```
cd android && node sync-web-assets.mjs     # and/or
cd ios     && node sync-web-assets.mjs
```

Each script re-copies the game, applies the one patch that app needs, and
mirrors the result into the native project. They're idempotent — run them as
often as you like. They fail loudly rather than patching the wrong thing if the
web game's fetch calls change shape; if that happens, update the edit list
inside the script.

Never edit `android/www/`, `ios/www/`, or `assets/public/` directly. They are
generated and the next sync overwrites them.
