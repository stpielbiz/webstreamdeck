# Show a "No connection" message instead of freezing and restarting

## Goal
When a Fire Stick loses its connection (or the provider blocks it and nothing comes in), the app should stay usable and show a clear message, not freeze and restart itself.

## What happens today
The Fire TV app checks every few seconds that the page is answering. If it isn't, it reloads the page, and if that doesn't help, it restarts the whole app. With no connection, a reload can't load anything, so the app ends up in a restart loop. Why the page stops answering while offline is not yet confirmed.

## Plan
1. **Confirm the cause first.** Read the device logs from a no-connection freeze (logs must be on in Admin) to see which step was running when the page stopped answering: a stalled stream, a playlist/guide request, or the reload itself.
2. **Never reload or restart while offline.** Before the watchdog reloads or restarts, the app checks whether the device has internet. If it doesn't, it skips both and shows a "No connection" screen instead.
3. **Native "No connection" screen.** A full-screen message drawn by the Fire TV app itself, so it works even if the page is stuck: "No connection — Jolzplay can't reach the internet or your provider." Buttons: **Try again** and **Settings** (opens Fire TV network settings). It goes away by itself when the connection returns.
4. **Requests give up instead of hanging.** Playlist, guide and stream requests get time limits. When they run out, the page shows "Can't reach your provider" with Try again, and keeps showing saved channels, movies and shows.
5. **Player.** If a stream gets no data for about 15 seconds, the player stops trying, shows "No data from your provider" with Try again / Back, instead of retrying forever.
6. **Website version.** A small banner "You're offline" when the browser loses connection.

## What the user will notice
- No more freeze-then-restart when the connection drops.
- A clear message saying what's wrong and a button to try again.
- Saved lists stay browsable while offline.

## Technical details
- `MainActivity.kt`: use `ConnectivityManager` (`NetworkCallback` + `NET_CAPABILITY_VALIDATED`) to gate `webView.reload()` / `restartApp()`; add a native overlay view with focusable buttons; dismiss on network available and resume watchdog.
- `PlayerActivity.kt`: stall timeout -> error overlay instead of endless reconnect.
- Web: `AbortController` timeouts on provider fetches in `iptv-provider.ts` / `device-provider.ts`; `video-player.tsx` watchdog caps reconnect attempts and shows an error; `online`/`offline` listener banner.
- Native parts reach Fire Sticks with the next app update; web parts on publish.
