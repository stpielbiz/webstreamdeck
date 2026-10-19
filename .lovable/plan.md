# Fix "No NHL games today"

## Cause (confirmed)
The online schedule returns **no games** when asked for a range of dates (e.g. 19–21 Oct), but returns tonight's 4 NHL games when asked for a single day. Both the league categories and the "Game on" search use the range request, so they come back empty.

## Fix
- Ask for each day separately (yesterday-late, today, tomorrow in UTC) and merge the games, removing duplicates by game id.
- Apply to both the Live TV league categories and the "Game on" team search.
- Clear the 5-minute saved result so the fix shows right away after publish.

## Verification
- Call the schedule for NHL and confirm tonight's games (23:00 / 23:30 UTC) come back with broadcasters.
- Open "NHL today" in Live TV and confirm games show with start times or "In progress".
