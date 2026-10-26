# Resume shows and movies where you stopped

## What I found
- Your stop point is saved correctly: MobLand S1 E1 is stored at 15 min 52 s (of 59 min), updated just now.
- So the problem is on restart: the player is either started before your saved spot has loaded (starting near 0), or the TV app's player is told the spot but doesn't jump to it before playing. Which of the two happened isn't confirmed yet; step 1 checks it.

## Changes
1. **Confirm the cause** with the player log: record the resume time handed to the player and the time it actually starts at.
2. **Wait for the saved spot.** Play/Resume won't start a show or movie until your saved positions have loaded (a brief moment), so it never starts from 0 by mistake.
3. **Lock the resume time when playback starts.** While you watch, new saves won't change the start time or restart the stream.
4. **Pick the right saved spot.** For shows, use the exact episode's saved spot; for movies with several quality copies, use the most recent one.
5. **TV app player jumps reliably.** It moves to the resume time once the video is ready, and retries once if the jump didn't take. This part needs a new Fire TV app version.
6. **Never go backwards by mistake.** Tiny early positions (under 10 s) reported while the stream is still opening won't overwrite a later saved spot.

## Check
- Stop an episode at about 15 min, reopen it: it starts at about 15 min, in the browser and in the Fire TV app.

## Technical details
- `title-details-dialog.tsx`, `tv.watch.*`, `movies.$id`, `series.$id`: gate play on `progress.isSuccess`; freeze `startPosition` in a ref at play start; sort candidate rows by `updatedAt` desc.
- `video-player.tsx`: drop `startPosition` from `startNative` deps (use a ref) so a progress refetch can't relaunch the native player; same for the web seek at line ~509.
- `PlayerActivity.kt`: apply `EXTRA_START` via `seekTo` on `STATE_READY` first time, verify `currentPosition`, retry once; suppress `reportProgress` until the initial seek completes.
- `saveProgress` server fn: ignore updates under 10 s when the existing row is further along and not completed (unless explicitly restarted).
- Add a test for the resume-row choice (exact episode, newest copy).
