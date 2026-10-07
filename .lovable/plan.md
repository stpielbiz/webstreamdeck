# Live TV guide: time-only focus and easy return to "now"

## What changes
- Only programme times can be selected with the remote; channel names stay visible on the left but are no longer stops.
- Moving Up/Down keeps you near the same time on the next channel, instead of jumping back to the start or to the channel name.
- Moving Left back through the times always lands on the programme playing now. One more Left returns to the categories.
- The guide scrolls with your focus, so the programme you're on is never hidden behind the channel names, and coming back left brings the timeline back to the current time.
- A "Now" button above the timeline jumps straight back to the current programme on the channel you're on.
- OK on any programme, current or future, starts that channel (preview first, OK again for full screen, as now). Rows with no listings keep a single "No programme information" box that does the same.

## Technical details
- `tv.live.tsx`: remove `data-tv-focus` from the sticky channel-name button (keep it clickable by mouse/touch); first programme cell per row gets `data-focus-key="channel-<id>"`, `data-zone-edge-left`, and `data-zone-entry` on the first row, so existing focus restore and Back keep working.
- On cell focus, manually scroll `guideRef` horizontally so `cell.offsetLeft - 300` (sticky column width) is visible, and set to 0 when the first cell is focused. Vertical: `scrollIntoView({ block: "nearest" })`.
- Up/Down: in `use-spatial-nav` the guide zone already uses geometry; ensure candidates are cells only (channel names removed), picking the cell overlapping the current cell's x-center.
- "Now" button: scrolls guide to 0 and focuses the focused row's first cell.
- Verify with Playwright: Right ×4, Left back to now, Left to categories, Down between rows, Enter on a future cell starts preview.
