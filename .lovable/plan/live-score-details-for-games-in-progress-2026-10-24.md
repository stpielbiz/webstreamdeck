# Live score details for games in progress

## What you'll see
A game that is on now in **NHL today** (or any league):
```text
Leafs at Sharks   In progress   2nd 12:30
[ Score details ] [ Sportsnet · 4 ] [ TVA Sports · 1 ]
```
- A new **Score details** button sits first in the row, before the network buttons.
- OK on it opens the scoring summary underneath: goals by period with the time, scorer and assists (same layout as finished games). OK again closes it.
- Only one panel is open at a time per game: opening Score details closes an open network, and opening a network closes Score details.
- While open, the details refresh by themselves every minute so new goals show up.
- Games that haven't started don't get the button. Finished games keep working as they do now.
- If nothing has been scored yet, it says "No goals yet."

## Technical details
- `src/components/sports-schedule.tsx` GameBlock: when `game.state === "in"`, render a "Score details" chip first (`data-tv-focus data-focus-glow data-sport-item`, takes zone entry for the first game). Panel state becomes `network | "score" | null`, stored in the existing `openNetworks` map.
- `ScoringSummary` gains a `live` prop: `staleTime` 60s and `refetchInterval` 60s when live (24h cache for finals), and an empty-state message "No goals yet." when live.
- No server changes: `getGameSummary` already reads the same game summary, which includes in-progress plays.
- Website change only; no app update.
