# Starting the next episode marks the previous one as watched

## What the user gets
- When you start any episode of a show, every earlier episode you had started but not finished (same show, earlier in the season or in an earlier season) is marked as watched, even if you skipped the last few minutes of credits.
- Those episodes leave "Continue watching" and show as watched in the episode list; the show's Continue watching entry moves to the new episode.
- Episodes you never started aren't touched, and later episodes are never changed.

## Changes
1. When an episode's progress is first saved, mark earlier unfinished episodes of the same show on that playlist as watched.
2. Continue watching and the episode list refresh straight away.
3. Add a test for which episodes count as "earlier" (same season lower number, or any earlier season).

## Technical details
- `saveProgress` in `src/lib/iptv.functions.ts`: for `itemKind = "episode"` with `seriesId`, `season`, `episode`, run an update on `watch_progress` setting `completed = true` where same user, playlist, `series_id`, `completed = false`, and `(season < s) or (season = s and episode < e)`. Runs on every save but is cheap (indexed by user/playlist; no-op after the first time).
- Pure helper `isEarlierEpisode(a, b)` in a small util with a vitest test; the query mirrors it.
- Existing invalidation of `["progress"]` after save refreshes the UI.
