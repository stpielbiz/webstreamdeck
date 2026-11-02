# Check that Back saves the right resume time

## What the data shows
- 1883 S1 E7 was last saved at **24 min 33 s** (2:24 pm). You remember stopping around 15–20 min.
- So the saved time is not too early, it is either correct (and the guess is off) or later than your stop. Last week's E4 was the opposite: saved at 47 min but resumed near 43. This points at the **resume jump landing in the wrong spot**, not at Back losing the time.
- The cause is not confirmed yet, so step 1 is to measure.

## Plan
1. **Show the saved time** on Continue Watching tiles and the episode start ("Resume from 24:33"), so you can compare with where you stopped.
2. **Log every stop and resume** (Admin logs): the position the player had when Back was pressed, the position the site saved, the target of the resume jump, and where playback really landed after 3 seconds.
3. **Make Back's final save certain**: send the final position with the close message itself, and have the site save it before leaving the screen, instead of relying on a separate earlier message.
4. **Fix based on the logs**: if the landing is early, keep retrying the jump until within 10 s of the target; if the saved value is wrong, fix the saving side.

## Technical details
- `PlayerActivity.kt`: pass `currentPosition/duration` into `onClosed`; `MainActivity` calls `__streamDeckClosed(pos, dur)`; NativeLog lines for stop/seek target/landed.
- `video-player.tsx`: on close with a position, call `progressRef` first and await before `stopRef`; debugLog the values.
- `saveProgress` (iptv.functions.ts): log incoming vs stored position.
- Steps 2–4 on Fire TV need the next app update; step 1 is website-only.
