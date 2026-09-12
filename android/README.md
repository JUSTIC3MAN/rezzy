# RezMe — Android app

The Rezzy game packaged as a native Android app with [Capacitor](https://capacitorjs.com).
The game's files ship **inside** the app, so it opens instantly and plays with no
internet. Only the leaderboard reaches the network.

The web version in the parent folder is untouched and still runs at
<https://acalan-rezzy.vercel.app>. This folder is a separate build of the same game.

| | |
|---|---|
| App name | RezMe |
| Package ID | `com.rezme.game` |
| Orientation | Landscape, locked |
| Min Android | 6.0 (API 23) |
| Targets | Android 15 (API 35) — Play's current requirement |
| Leaderboard | `https://acalan-rezzy.vercel.app` |

---

## Build it

You need [Android Studio](https://developer.android.com/studio). It brings the
Android SDK and Gradle with it — that's the ~1 GB download, and there's no way
around it.

1. Open Android Studio → **Open** → select the **`android`** folder inside this one.
   Not this folder — the `android` subfolder.
2. Wait for the first Gradle sync. It downloads dependencies and takes a few
   minutes the first time only.
3. Plug in a phone with USB debugging on, or start an emulator.
4. Press **Run** (▶).

That's the whole loop. The green Run button also produces a debug APK at
`android/app/build/outputs/apk/debug/app-debug.apk` if you'd rather sideload it.

## Change the game, update the app

The web game is the source of truth. After editing it, run:

```
node sync-web-assets.mjs
```

That copies the game across, applies the one change the app needs, and mirrors
it into the native project. Then hit Run again. Safe to run as often as you like.

---

## Publish to Google Play

1. **Play Console account** — $25, one time, at
   <https://play.google.com/console>. Allow a few days for identity verification.

2. **Generate a signing key.** In Android Studio: **Build → Generate Signed App
   Bundle → Android App Bundle → Create new…**

   > **Back this keystore up somewhere you will not lose it, along with its
   > passwords.** If it's gone, you can never publish an update to this app
   > again — Google will not re-issue it, and your only route is a new listing
   > with a new package ID and zero installs. Put a copy somewhere off your
   > laptop.

3. **Build the bundle.** Same dialog, choose **release**. You get an `.aab` at
   `android/app/build/outputs/bundle/release/app-release.aab`. That's the file
   Play wants — not an APK.

4. **Store listing.** You'll need:
   - Title — up to 30 characters. Set to whatever you want; it's independent of
     the package ID and you can change it later.
   - Short description (80 chars) and full description (4000).
   - **App icon 512×512** — ready for you at `store-assets/play-store-icon-512.png`.
   - **Feature graphic 1024×500** — you'll need to make this one.
   - At least 2 screenshots. Landscape, since the game is landscape. Take them
     from a running device: Android Studio's **Screenshot** button in Logcat, or
     the phone's own screenshot key.

5. **Data safety form.** Say yes — the game collects data. When someone submits a
   score it sends the **name they typed** to the leaderboard server. It's
   optional (Skip is right there), it isn't tied to an account, and nothing else
   leaves the device. Declare it as an optional, non-identifying in-app name.
   Do not claim the app collects nothing; that's the kind of mismatch that gets
   a listing pulled.

6. **Content rating** questionnaire and a **privacy policy URL** are both
   required before you can publish. The privacy policy has to be a real page you
   host — one honest paragraph about the leaderboard name is enough.

---

## How it's put together

```
android/                    ← this folder
├── www/                    generated; the game, copied from the web project
├── android/                the native project — open THIS in Android Studio
│   └── app/src/main/
│       ├── assets/public/  generated; where the app reads the game from
│       ├── java/…/MainActivity.java
│       ├── res/            icons, splash, themes
│       └── AndroidManifest.xml
├── store-assets/           512×512 Play Store icon
├── capacitor.config.ts     app id, name, background colour
├── sync-web-assets.mjs     re-copies the game from the web project
└── package.json
```

`www/` and `assets/public/` are both **generated** — anything you edit there is
overwritten on the next sync. Edit the web game in the parent folder instead.

### The things that needed deciding

**Leaderboard URLs.** In a browser the game and API share an origin, so
`/api/get-scores` works. In the app it doesn't: Capacitor serves the game from
`https://localhost`, so that path would ask the app for its own bundled files.
Every API call is prefixed with `window.REZZY_API_BASE` from `config.js`. If the
backend ever moves, change `API_BASE` in `sync-web-assets.mjs` and re-sync.

**CORS.** Because the app calls Vercel from a different origin, the API had to
say it allows that. `lib/cors.js` in the web project is new, and both endpoints
call it. This does not loosen anything — the leaderboard was already public and
unauthenticated — it just stops the WebView from blocking the calls. **The web
project needs a redeploy for this to take effect**, or the app's leaderboard will
fail while the website's keeps working.

**Fullscreen.** `MainActivity` hides the status and navigation bars and re-hides
them when focus returns. It uses the older `setSystemUiVisibility` flags rather
than the modern `WindowInsetsController` — deprecated, but they compile against
every SDK level in range, and this project couldn't be test-compiled here.

**Landscape.** Locked in the manifest. The game's own "rotate your device"
notice is now unreachable, which is the intent — the OS handles it instead.

**Icon.** Built from `Items/FairyInBottle.png` on a deep indigo radial ground.
Rezzy himself is only ~170px in the sprite sheets, too small to upscale cleanly
to 512. To swap it, replace the source in the icon step and regenerate, or drop
your own PNGs into the `mipmap-*` folders.

### Known limitations

- **No APK was built here.** The environment this was assembled in blocks
  `dl.google.com`, `maven.google.com`, `repo1.maven.org` and `services.gradle.org`,
  so nothing could be compiled. The project is complete and ready; the compile
  happens on your machine.
- **Untested on a device.** Everything is verified by inspection — syntax
  checks, resource layout, manifest structure — but no one has run it on a phone
  yet. Expect to shake out one or two small things on first launch.
- **Audio.** The game has no sound, so nothing was configured for it. If you add
  audio later, Android will need it handled through the media session for it to
  behave properly with the volume keys.
