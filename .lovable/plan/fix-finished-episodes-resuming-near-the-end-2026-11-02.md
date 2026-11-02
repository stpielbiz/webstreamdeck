# Fix "finished" episodes resuming near the end

## What the saved data shows
Your recent watch of **1883 S1 E4** (54 min 48 s long) was saved at **47 min 23 s**, the last time it played on Oct 29. The stop point was recorded; the problem is what counted as "finished":
- An episode only counted as watched once you reached **95%** of its length (about 52 min here). Stopping during the end credits left it "in progress", so it came back as a resume at ~47 min.
- It only got marked watched later, when you started the next episode (the rule added last week).
- The ~4 minute gap between the saved 47 min and the ~43 min you saw is unconfirmed; the likeliest cause is the stream jumping back to an earlier point when skipping ahead. I'll check this during the fix.

## Changes
1. **Credits count as finished.** A movie or episode counts as watched when you stop in the last part of it: the last **10%**, or the last **8 minutes** for anything over 40 minutes, whichever comes first. Finished titles drop out of Continue Watching and restart from the beginning.
2. **The stop point is the last thing saved.** When you press Back, the final position is saved, and a slower save from a few seconds earlier can no longer overwrite it.
3. **Check the resume jump.** After playback jumps to the saved spot, check where it actually landed. If the stream lands more than 30 s early, try the jump again once, and record in the logs where it was meant to start and where it landed.
4. **Tests** for the finished rule: 47:23 of 54:48 counts as finished, 15:00 of 54:48 doesn't, and a 22-minute episode stopped at 20:30 counts as finished.

## Technical details
- Add a shared `isFinished(position, duration)` helper in `src/lib/watch-progress.ts`. Use it in `saveProgress` (`iptv.functions.ts`) in place of the `> 0.95` check, and in the client-side resume code that chooses 0 or the saved position.
- In `saveProgress`, skip a write when its position is older than one already stored from the last few seconds. Use a client timestamp passed in, so saves that arrive out of order are ignored.
- Native `PlayerActivity.kt`: after the seek in STATE_READY, check `currentPosition` against `pendingStartMs` and retry once. Changes in the Fire TV app only reach devices with the next app release.
- Add `src/lib/watch-progress.test.js` with the rule tests above.
