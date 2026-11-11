# Fix MobLand S1E1 resuming at 41:19 after you finished it

## What I found
- Your account has one saved spot for MobLand S1E1: **41:19 of 59:18**, last saved yesterday at 10:43 PM (Toronto).
- An episode counts as watched once you pass 51:18 (the last 8 minutes). So the app's last save happened about 18 minutes before the end, and nothing after that was saved: no later spot, no "watched" mark.
- No playback logs exist for that evening, so the exact reason the saves stopped is **not confirmed yet**. The likely suspects: the TV app player stops passing your position back to the app during long viewing, or the end of the episode and the final stop are never saved.

## Plan
1. **Confirm the cause first.** Add log lines for every position save: when it's sent, when it's skipped, and when it fails. Also log when an episode ends and when the player closes. Then you watch about 15 minutes with logs on, and I check where the saves stop.
2. **Always save the stop point on close.** When the TV app player closes, save the last position it reported, even if regular saves were missed along the way.
3. **Mark the episode watched when it ends.** When the player reports the end of an episode, save it as watched no matter what position was last saved.
4. **Retry failed saves.** If a save fails (for example because your sign-in was being renewed), keep it and resend it shortly, instead of dropping it.
5. **Fix your MobLand S1E1** by marking it as watched, so it stops asking you to resume it.

## Technical details
- `video-player.tsx`: in `close()`, send `progressRef(lastNativePositionRef, lastDuration)`. In `__streamDeckEnded`, send a final save at the full duration.
- `saveWatchProgress` client wrapper: keep one pending save and retry on error. Add diagnostics via `debugLog("progress", …)`.
- Check that the native bridge keeps calling `__streamDeckProgress` during playback (`native-app` player). Any native change only reaches Fire Sticks with the next app update.
