# Sports package: today's games per league in Live TV

## What you'll see
**Settings**
- New card **Sports package** (whole-card toggle, off by default).
- When on, a list of leagues appears underneath, each its own toggle: NHL, NBA, NFL, MLB, MLS, Premier League, LaLiga, Champions League, Rugby (internationals, Rugby Championship, Six Nations, URC, Premiership, Super Rugby). Saved to your account, so every device gets the same choice.

**Live TV**
- For each league you picked, a category appears pinned near the top (after Favourites/Recent and your favourite categories), e.g. **"NHL today"**, **"Rugby today"**. It's rebuilt automatically every day, nothing to manage.
- Opening it lists today's games (and early tomorrow), one row per game:
  - **Later today:** the matchup with its start time, e.g. "Canadiens at Bruins · 7:00 PM".
  - **On now:** "In progress" badge (with score/period when available).
  - **Finished:** "Final" — dropped from the list a couple of hours after the end.
- Under each game, its suggested channels from your playlist (same matching as the "Game on" search). OK on a channel starts it full screen; Back returns to the game list.
- If a league has no games today, its category shows "No games today" (or is hidden — hidden by default).

## Technical details
- Migration: add `sports_enabled boolean default false` and `sports_leagues text[] default '{}'` to `user_settings`; extend settings.functions.ts get/save.
- `game-broadcasts.functions.ts`: new `getLeagueSchedule({ leagues })` returning all games for today+early tomorrow per league with `{ id, matchup, startsAt, state: pre|in|post, detail, teams, broadcasts }` (ESPN status.type.state / shortDetail), cached 5 min; shared league list moved to a browser-safe `sports-leagues.ts`.
- Live TV (`tv.live.tsx`, and `live.tsx` web): virtual categories `sports:<league>` built from the schedule query (refetch every 5 min while open); game rows render in the channel pane in place of the programme timeline, each game an own remote row with channel buttons via `suggestChannels`.
- Settings UI uses existing `SettingToggleCard` for the master toggle and each league.
- Tests: schedule state → label ("7:00 PM" / "In progress" / "Final"), and hiding finished games after 2h.
