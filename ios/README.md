# RezMe — iOS app

The Rezzy game packaged as a native iOS app with [Capacitor](https://capacitorjs.com).
The game's files ship **inside** the app, so it opens instantly and plays with no
internet. Only the leaderboard reaches the network.

The web version in the parent folder is untouched and still runs at
<https://acalan-rezzy.vercel.app>. The `android/` folder next to this one is
untouched too. This is a third, separate build of the same game.

| | |
|---|---|
| App name | RezMe |
| Bundle ID | `com.rezme.game` |
| Orientation | Landscape, locked |
| Min iOS | 14.0 |
| Leaderboard | `https://acalan-rezzy.vercel.app` |

---

## Do you have to pay Apple $99 to test this on your phone?

**No.** Not to run it on an iPhone you own.

Apple's own [membership comparison](https://developer.apple.com/support/compare-memberships/)
says a free account can "install and test your apps on a personal device."
The limits it comes with:

- The app expires **7 days** after it's installed, then has to be re-signed.
- Up to **3 devices** and **3 sideloaded apps** on a device at a time.

The $99/year Apple Developer Program buys three things you don't need yet:
signatures that last a year instead of a week, **TestFlight** (sending builds to
other people's phones), and the App Store itself.

**The catch isn't the money — it's the Mac.** Xcode only runs on macOS, and
Xcode is what compiles an iOS app. You have a Windows PC. So the build happens
on a rented Mac for the five minutes it takes, and everything else happens on
your machine.

That's the route below. Total cost: nothing.

---

## Get it on your iPhone

Three stages. The first two are one-time setup; after that a new build is two
clicks and about five minutes.

### 1. Build the .ipa on a cloud Mac

[Codemagic](https://codemagic.io) gives **500 free macOS minutes a month** on
its free plan. This build uses about five of them, so roughly a hundred builds
a month before you'd ever pay anything.

1. Push this project to a Git repo — GitHub, GitLab or Bitbucket, private is
   fine. `codemagic.yaml` in this folder is already written; Codemagic reads it
   automatically.
2. Sign up at <https://codemagic.io>, connect the repo.
3. Pick the **`ios-unsigned`** workflow and press **Start new build**.
4. When it finishes, download **`RezMe-unsigned.ipa`** from the build's
   artifacts. It also gets emailed to you.

The app it produces is complete and has no signature on it. That's deliberate —
signing is the next stage, and it happens on your PC with your own Apple ID.

### 2. Set up Sideloadly on Windows

[Sideloadly](https://sideloadly.io) signs an `.ipa` with your Apple ID and
installs it on a connected iPhone. It runs on Windows and works with a free
Apple ID — from its FAQ: *"Sideloadly works with free Apple IDs. With a free
account, sideloaded apps are valid for 7 days."*

One thing that trips people up: **it needs the web downloads of iTunes and
iCloud, not the Microsoft Store versions.** If you have the Store ones,
uninstall them first — the links are on Sideloadly's own page. They're only
there for the USB drivers; you never open iTunes.

### 3. Install

1. Plug the iPhone into the PC with a cable. Unlock it and tap **Trust**.
2. Open Sideloadly, drag `RezMe-unsigned.ipa` onto it, enter your Apple ID.
3. Press **Start**. It signs and installs in under a minute.
4. On the iPhone: **Settings → General → VPN & Device Management**, tap your
   Apple ID, tap **Trust**. iOS refuses to launch a sideloaded app until you do
   this, once per Apple ID.
5. Open RezMe.

After the first cable install you can pair over Wi-Fi and skip the cable next
time. Sideloadly also has a refresh daemon that re-signs the app before the 7
days run out — leave it on and the app just keeps working.

> **Use a spare Apple ID if you have one.** Sideloadly asks for the password of
> whatever ID you sign in with. Nothing about that is unusual for sideloading,
> but a second free Apple ID costs nothing and keeps your main account out of
> it. Your 3-apps-per-device limit is per Apple ID anyway.

---

## Change the game, update the app

The web game is the source of truth. After editing it, run:

```
node sync-web-assets.mjs
```

That copies the game across, applies the changes the iOS build needs, transcodes
the videos and hands the result to the Capacitor CLI. Then push, and start
another Codemagic build. Safe to run as often as you like — re-running only
re-encodes a video whose source actually changed.

---

## Publish to the App Store

This is where the $99 becomes unavoidable.

1. **Join the Apple Developer Program** — $99/year at
   <https://developer.apple.com/programs/>. Identity verification takes a few
   days, sometimes longer for an individual outside the US.

2. **Create the app in App Store Connect** with bundle ID `com.rezme.game`.

3. **Give Codemagic a key.** App Store Connect → **Users and Access → Integrations
   → App Store Connect API** → generate a key with **App Manager** access.
   Download the `.p8` — you get exactly one chance at that file. Add it to
   Codemagic under **Teams → Integrations → App Store Connect**, named
   `RezMe App Store Key` to match `codemagic.yaml`.

4. **Put the app's Apple ID in `codemagic.yaml`.** It's the ten-digit number in
   the App Store Connect URL for your app. Replace the `0000000000` placeholder
   under `APP_STORE_APPLE_ID`.

5. **Run the `ios-release` workflow.** It signs, builds and uploads to
   TestFlight. From there you can install it on your own phone with a year-long
   signature instead of a week, and invite other testers.

6. **Store listing.** You'll need:
   - App name, subtitle, description, keywords.
   - **App icon 1024×1024** — ready at `store-assets/app-store-icon-1024.png`.
   - Screenshots for a 6.7" iPhone, landscape. Take them on the phone with the
     app running.
   - A **privacy policy URL**. Required, and it has to be a real page you host.
   - **App Privacy questionnaire.** Answer honestly: the game collects data.
     Submitting a score sends the **name the player typed** to the leaderboard.
     It's optional (Skip is right there), it isn't linked to an identity, and
     nothing else leaves the device. Declare it as optional, non-identifying
     user content used for app functionality. Claiming the app collects nothing
     is the kind of mismatch that gets a listing pulled.
   - **Age rating** questionnaire.

Apple's review takes a day or two, and first submissions get rejected more often
than not for small things. That's normal — they tell you what to fix.

---

## How it's put together

```
ios/                        ← this folder
├── www/                    generated; the game, copied from the web project
├── ios/                    the native project
│   └── App/
│       ├── App.xcworkspace     open THIS if you ever get a Mac
│       ├── Podfile
│       └── App/
│           ├── public/         generated; where the app reads the game from
│           ├── Info.plist      orientation, status bar, fullscreen
│           ├── Assets.xcassets app icon and launch screen
│           └── Base.lproj/     LaunchScreen.storyboard
├── store-assets/
│   ├── app-store-icon-1024.png
│   └── make-icon.py        regenerates the icon and launch screen
├── .video-cache/           generated; transcoded MP4s, not committed
├── capacitor.config.ts     app id, name, background colour, WebView behaviour
├── codemagic.yaml          the cloud build
├── sync-web-assets.mjs     re-copies the game from the web project
└── package.json
```

`www/` and `App/App/public/` are both **generated** — anything you edit there is
overwritten on the next sync. Edit the web game in the parent folder instead.

### The things that needed deciding

**Video.** The backgrounds are VP9-in-WebM with an Opus audio track. Whether iOS
plays that depends on the iOS version, and where it does, most iPhones decode
VP9 in software — CPU work, and heat and battery drain, for a video that loops
for as long as the game is open. The sync script transcodes all five to H.264
MP4, which every iPhone ever made decodes in dedicated hardware, and drops the
audio track because the element is muted anyway. The files come out a little
larger; the tradeoff is not close. This is the biggest single difference from
the Android build, which ships the WebM files as they are.

**Leaderboard URLs.** Same problem the Android app has. In a browser the game
and API share an origin, so `/api/get-scores` works. In the app it doesn't:
Capacitor serves the game from `capacitor://localhost`, so that path would ask
the app for its own bundled files. Every API call is prefixed with
`window.REZZY_API_BASE` from `config.js`. To move the backend, change
`API_BASE` in `sync-web-assets.mjs` and re-sync.

**CORS** was already solved for Android — `lib/cors.js` in the web project, on
both endpoints. iOS calls the same API from a different origin and rides on the
same fix. Nothing new was needed, but it does mean **the web project has to have
been deployed since that change**, or the app's leaderboard fails while the
website's keeps working.

**Landscape and fullscreen.** Locked to landscape in `Info.plist`, status bar
hidden, `UIRequiresFullScreen` set so iPad can't hand the game half a screen in
Split View. The game's own "rotate your device" notice is unreachable now, which
is the intent — the OS handles it.

**The notch and the keyboard.** `ios-tweaks.css` keeps the trophy button inside
the safe area and kills the long-press callout menu, which otherwise fires
mid-gesture during play. `ios-tweaks.js` handles the one thing that genuinely
breaks: an iPhone keyboard in landscape covers over half the screen, and the
name-entry modal is centred, so the input would open behind the keys. It watches
`visualViewport` and lifts the modal into whatever strip is still visible. Both
files are generated by the sync script and neither exists in the web version.

**Icon.** Built from `Items/FairyInBottle.png` on a deep indigo radial ground, to
match the Android one. `store-assets/make-icon.py` regenerates it and the launch
screen. Two Apple rules it obeys: no alpha channel, and square corners — iOS
applies its own rounded mask, and an icon that arrives pre-rounded gets rounded
twice and comes out pinched.

**`.gitignore`.** The project root ignores `package.json` and `package-lock.json`
everywhere, which is correct for the web project — it deploys by CLI upload, so
its dependencies never need to be in the repo. The iOS build is the opposite:
Codemagic clones the repo and runs `npm ci` on the cloud Mac. `ios/.gitignore`
puts those two files back for this folder only. A nested `.gitignore` wins over
the root for its own directory, so nothing outside `ios/` changed.

### Known limitations

- **Nothing has been compiled.** This was assembled on the Windows machine,
  where Xcode does not exist. The project is complete and the config is
  verified by inspection, but the first real compile happens on Codemagic.
  Budget an hour for the first build — CI configs rarely go green on attempt one.
- **Untested on a device.** No one has run this on an iPhone yet. Expect to
  shake out one or two small things on first launch.
- **The home indicator stays visible.** Hiding it needs a
  `prefersHomeIndicatorAutoHidden` override on the view controller, which means
  a new Swift file and an edit to `project.pbxproj` — not worth hand-writing
  without a Mac to compile against. It's a thin bar at the bottom edge and the
  game is letterboxed above it.
- **Audio.** The game has no sound. If you add any, iOS needs an `AVAudioSession`
  category set or it will duck the user's music and go silent on the ring switch.
