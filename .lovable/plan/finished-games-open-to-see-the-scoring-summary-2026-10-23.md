# Finished games: open to see the scoring summary

## What you'll see
- Press OK on a finished game in **NHL today** (or any league) and the card opens underneath, showing how the game was scored, grouped by period:

```text
Maple Leafs 4 – 2 Sharks   Final
1st period
  12:34  TOR  Matthews (Marner, Nylander)
  18:02  SJ   Celebrini (Eklund)
2nd period
  ...
OT / Shootout (when it happened)
```
- Each line shows the time, the team's logo or short name, the scorer, and the assists in brackets ("unassisted" when there are none).
- Press OK again to close it. Only one finished game is open at a time. Up/Down still move between games.
- While the details load, a short shimmer shows. If they can't be found, the card says "Scoring details not available".
- **Other leagues:** soccer shows goals with the minute, NFL shows scoring plays by quarter, NBA/MLB show scoring by period or inning when the schedule has it. Hockey gets the full goal and assist lines.
- Details are fetched only when you open a game, then kept for the day, so opening it again is instant.

## Technical details
- `game-broadcasts.functions.ts`: new `getGameSummary({ id })` server function. The id is the existing `path:eventId`. It calls ESPN `.../{path}/summary?event={id}` with the browser User-Agent, reads `scoringPlays` (period.number, clock.displayValue, team.abbreviation/logo, text), and splits hockey text "Scorer (n) Assists: A, B" into scorer and assists. Returns `{ plays: { period, periodLabel, clock, team, logo, scorer, assists[] }[] }`. Soccer falls back to `keyEvents` goals.
- `sports-schedule.tsx` FinalBlock: becomes an expandable card (`aria-expanded`); the panel holds the open game id; a `useQuery(["game-summary", id])` runs only when open, with staleTime of a day; the details list isn't focusable, so the remote only stops on the card.
- Period labels in `sports-leagues.ts` (`periodLabel(sport, n)`: 1st/2nd/3rd/OT/SO, quarters, halves, innings) with bun tests.
- Website change only; no app update.
