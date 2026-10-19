# Fix: Fire TV app locks up (and recover without force stop)

## What the logs showed
The logs from your Fire Stick (saved at 10:54 and 10:55 PM) show the website stopping completely for about 5 seconds, roughly every 10 seconds. This happened even on the TV home menu, before you opened Live TV. Each time, the remote buttons pile up and only go through once the stall ends. The logs stop being saved shortly before the freeze you had in Live TV. That means the page itself was stuck, not just the selection being lost. So the earlier focus fixes could never have solved this.

The cause isn't confirmed yet. The most likely culprit is background work that runs over your whole library while you browse:
- filling in movie and show details (runs every 15 seconds over every title, about 14,000 of them);
- saving those details and the TV guide to the Fire Stick's storage (this copies the whole list each time, on the same thread that handles the remote);
- recounting the library status shown on the TV home after each of those updates.

On a Fire Stick each of these can take seconds. When they line up, for example when you come back from the player, the screen locks.

## Fix
1. **Measure first.** Time each of the jobs above on the device, and log any that take longer than 0.3 seconds. Also upload logs saved before a freeze the next time the app opens, so we always get the trail.
2. **Stop heavy work while you watch or have just stopped.** All background updates pause while the full-screen player is open and for 15 seconds after it closes. They also never run while a remote button is held.
3. **Make the background work light.**
   - Details fill-in: match titles once, not every 15 seconds. Do the work in small pieces with breaks, so a button press always gets through.
   - Saving to the device: save the big lists at most once a minute, and only the parts that changed. Skip saving while the player is open.
   - Library status on the TV home: only count it when that panel is on screen, using a quick count.
4. **Self-recovery in the Fire TV app (next app update).** The app checks that the website is still responding. If the page is stuck for more than 10 seconds, it reloads that same screen by itself, so nobody has to force stop the app.

## Check
- On a slow test device setup in a real browser: load a large sample library, browse Home and Live TV, and confirm there are no "unresponsive" stalls over 0.5 seconds in the logs.
- On your Fire Stick after publishing: open Live TV, start and stop a channel a few times. With logs still on, the saved logs should show no stalls; tell me if anything freezes.

## Technical details
- `debug-log.ts`: mark loaded localStorage entries dirty so they upload at launch; add `timed(scope, label, fn)` helper logging >300 ms.
- `library-sync.tsx` `useTitleBackfill`: cache name→key map per catalogue revision; process matching in 500-name slices with `setTimeout(0)` yields; skip while `StreamDeckNative.isPlayerOpen()` or within 15 s of close; skip when keys held.
- `useLibrarySync` guide loop and `mergeGuide`: same pause gate; avoid rebuilding the whole store per 40-channel batch (merge once per several batches).
- `device-cache.ts`: per-key debounce raised to 60 s for `cached-title-metadata`, `system-catalogue`, `device-guide`; skip writes while native player open; flush on `visibilitychange` hidden only if idle.
- `useLibraryOverview`: compute only when the library panel is mounted/visible; drop per-name `lookupKeyFor` in the hot path.
- Shared pause signal: `src/lib/background-gate.ts` (player open/closed timestamps from `video-player.tsx`, key-hold state).
- Native `MainActivity.kt`: JS heartbeat watchdog (evaluateJavascript ping every 3 s; if no answer for 10 s while resumed and the player isn't open, `webView.reload()`).
