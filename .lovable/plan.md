# Stop the "Preparing your library" message after a full update

## What's happening
After **Update everything** finishes, the Home menu shows "Preparing your library… TV guide 120/1,500 channels". That message is meant for a device's very first load. It makes it look like the update you just ran is starting over.

The most likely cause: when the full update ends, the regular background update starts right away. It checks the TV guide again and shows its progress with the "first time" wording. I still need to confirm this on screen.

## Fix
1. **Confirm first.** Run a full update in the browser with a sample playlist and see what triggers the message after it ends.
2. **No re-check right after a full update.** Once a full update finishes, the background update waits its normal interval (a few hours) before checking the guide again. Channels, movies and shows aren't downloaded twice.
3. **Show the guide progress as part of the full update.** While the full update card is working, it shows the guide step ("TV guide 300 / 1,500") itself, and the small Home message stays hidden.
4. **Clearer wording.** "Preparing your library…" only appears when the device has no saved channels yet. Quiet background refreshes of the guide show "Updating TV guide 120 / 1,500" instead, or nothing at all on Home.

## Check
- Run Update everything, wait for "All set", then stay on Home for 2 minutes: no channel or library message should come back.
- New device with nothing saved: "Preparing your library…" still shows.

## Technical details
- `library-sync.tsx` `useLibrarySync`: when the forced run finishes, store a `lastFullRunAt` per playlist; the effect that re-runs because `force` turns false skips `run()` if the last full run ended within `GUIDE_TTL`. Expose `firstLoad` in `SyncStatus` (true only when `tv-live-items` had no saved data).
- `tv.index.tsx` line 138: show "Preparing your library…" only when `sync.firstLoad`; hide the line while the full update card is running.
- Website only; no app update.
