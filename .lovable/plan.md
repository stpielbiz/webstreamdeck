# Final scores, no channel links for finished games

## What you'll see
- A finished game in **NHL today** (or any league) shows a compact result card: both team logos, team names and the final score, e.g. **Leafs 4 – 2 Sharks · Final** (or "Final/OT", "Final/SO" when the schedule says so). The winner's score is bold.
- No network buttons or channel cards under finished games, so the remote skips straight from the game above to the game below.
- Finished games still drop off about two hours after they end, as now.

## Technical details
- `game-broadcasts.functions.ts` (getLeagueSchedule): keep the score for `post` games too, as `scores: [away, home]` plus `detail` = ESPN shortDetail ("Final/OT").
- `sports-leagues.ts`: add optional `scores?: string[]` to `ScheduledGame`; `gameStatusLabel` stays "Final" (uses detail when present).
- `sports-schedule.tsx` GameBlock: when `state === "post"`, render a result row (logos, teams, scores) and skip the network/channel blocks; skip channel matching for those games. Remote movement already only uses `data-sport-item`, so finished games become non-focusable automatically.
- Test in `sports-leagues.test.js`: a post game with scores gives the "Final" label.
