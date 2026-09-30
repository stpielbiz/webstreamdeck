# Make streams play like TiviMate on the Firestick

## Why TiviMate works and the app doesn't

- **TiviMate** is an installed app, so it gets the stream straight from your provider over the Firestick's own connection (with your VPN). The provider allows it.
- **Stream Deck** runs in a web browser. It tries two things, and both fail:
  1. It asks the app's server to fetch the stream. Your provider now refuses our server (errors 511/513). That's why it worked on Sept 9 and doesn't now.
  2. It falls back to fetching the stream straight from the Firestick. The browser blocks this because your provider uses an unsecured (http) address and the app is secure (https). No browser allows this, so a better web player can't fix it.

So "its own player" has to live in an installed app, just like TiviMate. The plan has two parts: a quick workaround now and the real fix after.

## Part 1: "Play in VLC" button (quick, works this week)

- When a stream is refused, the error screen shows **Play in VLC** and **Play in MX Player** buttons instead of a dead end. They also appear in the player's controls.
- On Firestick and Android, the button opens the installed player app, which plays the stream over the device's own connection (your VPN included).
- On Windows, Xbox and iPhone, the button opens VLC if it's installed. A **Copy stream link** button is always there as a backup.
- The error message changes to plain words: "Your provider only allows streams from your own device. Open it in VLC or use the Stream Deck TV app."
- The Get App page adds a step: install VLC for Fire TV from the Amazon Appstore.

Downside: playback happens outside Stream Deck, so resume position isn't saved for those plays.

## Part 2: Stream Deck app for Firestick with its own player (the real fix)

- A small installable Android TV app (APK) that opens your Stream Deck account full screen and has a built-in video player (the same kind of player TiviMate uses).
- The pairing code, guide, movies, series, favourites and continue watching all stay the same. When you press Play, the app plays the stream itself on the Firestick, so the VPN and the provider's rules work like they do in TiviMate.
- Resume position and "continue watching" keep saving, because the built-in player reports progress back to your account.
- Remote buttons (play/pause, rewind, fast-forward, back, channel up/down) go to the built-in player.
- **Getting the app onto a Firestick:** the Get App page gets a "Download for Firestick" button, plus steps using the free Downloader app with a short code.

**One thing you'll need to do:** this editor can't package an Android app. I'll write the full app and an automatic build setup. You connect the project to GitHub (one click in Lovable), GitHub builds the APK, and you upload it or I link it from the Get App page. I'll give you step-by-step instructions.

## Order of work

1. Part 1: external-player buttons, clearer error, Get App VLC step.
2. Part 2: the Android TV app, the web app's handoff to its built-in player, progress reporting, automatic build setup, and the download page.
3. Test on your Firestick with the VPN on: a live channel, a movie with resume, and a series episode.

## Technical details

- **Root cause:** the provider base is `http://`. The server proxy (`/api/public/stream`) gets 511/513 from the provider. The client fallback `directUrl` fails from the `https` origin because of mixed-content blocking/auto-upgrade and missing CORS on provider responses (hls.js uses XHR). This can't be fixed in the browser.
- **Part 1:** new `src/lib/external-player.ts` builds links:
  - Android/Fire TV: `intent:<url>#Intent;package=org.videolan.vlc;type=video/*;end` (and `com.mxtech.videoplayer.ad`)
  - other devices: `vlc://<url>`
  - device detection uses the user agent (`Silk`, `AFT`, `Android`)
  `VideoPlayer` gets an optional `externalUrl` prop (the existing `directUrl`) and renders the buttons in the error overlay and control bar. All six call sites already pass `directUrl` as `fallbackSrc`, so they reuse it.
- **Part 2:**
  - New `native-app/android/` project: Kotlin, minSdk 22, Leanback launcher intent, a WebView loading `https://webstreamdeck.lovable.app/tv`, and a Media3 ExoPlayer activity (HLS + MPEG-TS + MP4/MKV).
  - JS bridge `window.StreamDeckNative.play(json)` with `{ url, title, live, startPosition, itemId, ... }`. The native player calls back `window.__streamDeckProgress(position, duration)`, which reuses `saveProgress`.
  - `VideoPlayer` checks for the bridge and hands off playback instead of using hls.js.
  - Build: `.github/workflows/android.yml` produces a signed release APK artifact (keystore stored as GitHub secrets).
  - `get-app.tsx` gets a download link and Downloader instructions.
- **Security:** the stream URL has the user's own provider credentials. It only goes to that signed-in user's own device (it's already returned by `getPlayback`).
