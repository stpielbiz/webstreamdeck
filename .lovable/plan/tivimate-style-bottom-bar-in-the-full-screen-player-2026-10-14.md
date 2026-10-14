# TiviMate-style bottom bar in the full-screen player

## What you'll get
While a channel is playing full screen on the Fire TV app, pressing **Down** (or moving the mouse on a computer) shows a bar along the bottom of the video with your **Recent channels** — like TiviMate. Left/Right moves along the bar, OK switches straight to that channel without leaving the player, and Back or Down hides the bar again. The bar hides itself after a few seconds if you don't touch anything.

## How it works
1. **The website hands the recent list to the player.** When the site asks the app to play a live channel, it now also sends your Recent channels (names and stream links) along with the request.
2. **The player draws the bar itself.** The Fire TV player gets a bottom strip: the current channel highlighted, recent channels beside it. Down shows it, Back/Down hides it, OK on another channel reloads the player with that stream (keeping the automatic reconnect).
3. **Switching channel keeps everything in sync.** When you switch from the bar, the player tells the website which channel you picked, so it counts as "watched" and moves to the top of Recent.
4. **Web browser:** moving the mouse or pressing Down over the full-screen player shows the same recent-channels strip at the bottom; clicking a channel switches to it.

## Technical details
- `src/lib/external-player.ts`: live `play()` requests include `recent: [{title, url}]` (from `useRecentChannels` + resolved stream URLs) in the native bridge JSON.
- `PlayerActivity.kt`: new bottom overlay (horizontal channel list, focus highlight, 5s auto-hide); `KEYCODE_DPAD_DOWN` shows it, Back/Down hides, OK on a row calls `load()` with the new URL and updates the title; new `Listener.onChannelSwitched(title, url)` callback.
- `MainActivity.kt`: `onChannelSwitched` forwards to the website via `window.__streamDeckChannelSwitched(...)` so `touchRecentChannel` runs.
- Web: `src/components/video-player.tsx` gets an optional bottom recents strip (mouse-move / ArrowDown shows it) fed by the same Recent data on the Live TV page.
- Native part needs the next APK; web part works on publish.
