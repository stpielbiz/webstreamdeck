# Live TV: easier remote movement (same look)

## What you'll get
- **Channel names are no longer stops.** The names stay on the left exactly as they look now, but the remote only lands on programme times. OK on a time starts the channel; holding OK still opens the favourite/record menu.
- **Right from a category goes into the guide, at the same height.** If your highlight is halfway down the category list, Right lands on the channel row closest to that spot (current programme), not the search box at the top.
- **Left from the current programme goes back to the category that's selected**, as now.
- **Up/Down in the guide** moves to the next/previous channel and stays at the programme closest to the same time on screen, never jumping to the start or to a far-away cell.
- **Up/Down in the categories** keeps moving one by one and scrolls with you.
- **Up from the first channel** goes to the search/buttons row; **Down from the buttons** goes to the first channel (or the league cards on a sports category).
- Nothing changes in the layout, colours or sizes.

## Technical details
- `tv.live.tsx`:
  - `ChannelNameButton`: drop `data-tv-focus` and set `tabIndex={-1}` so it stays clickable by mouse/touch only; long-press menu stays on programme cells.
  - Category buttons' `ArrowRight` handler: instead of focusing `live-search`, find the guide row whose vertical centre is nearest the category button's centre (among rows visible in the guide viewport; fallback first row) and focus its first cell (`data-focus-key="channel-…"`). Sports category keeps going to `sports-first-card`. Empty guide falls back to search.
  - `guideKeys` Up/Down: match by the focused cell's horizontal centre on screen (cell overlapping that x in the target row, else nearest by distance) instead of `idx === 0` / start time, so movement keeps the same visible column.
  - Pagination buttons ("Previous/Next channels") stay reachable at the top/bottom of the list.
- No native app change; website update only. Verify with Playwright at Fire TV size: category mid-list → Right lands on nearby row, Up/Down keep column, channel name never focused, Left returns to category.
