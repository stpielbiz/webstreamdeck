# Collapse shows that haven't been started in the franchise collection

## What you will see

- Opening a collection no longer lists every season and episode of every show.
- Shows you have **started watching** (any progress saved, even partially) open with their seasons and episodes visible, as they are today.
- Shows you have **never started** show only their title row: poster, name, and a hint like "3 seasons · tap to view". Nothing else.
- A small chevron/expand button beside each collapsed show expands it (and can collapse it again). On the remote: Left/Right reaches the expand button, OK opens the seasons.
- The show title row still plays the resume/next episode when OK'd, exactly as now.
- Movies are unchanged — each movie is a single row, nothing to collapse.

## Technical details

- File: `src/components/franchise-collection.tsx` only. No backend changes.
- In `ShowBlock`:
  - Detect "started": any progress row for the active playlist matching this show's series ID (episode rows carry `seriesId`), regardless of completed state. Reuse the existing `rows` prop (`progress.data`).
  - New local state `open`, initialised to `started` (shows with progress expand automatically; others start collapsed).
  - When collapsed, render only the header row plus an "Expand" toggle button (chevron icon) instead of the seasons list. The header button keeps `data-focus-key={showKey}` and its current OK behaviour (plays resume/next episode).
  - The toggle button gets `data-tv-focus` and sits inside the header row; expanding also focuses the first episode row so remote navigation flows into the list.
- Keep the existing remote-row/focus attributes so TV navigation stays deterministic.

## Verification

- Check `/tmp/observability/build-errors.log` after the edit.
- Preview at Fire TV size: unstarted shows render as single rows with the expand chevron; a show with saved progress opens expanded; OK on a collapsed show still plays; the expand button is reachable by the remote and opens the seasons.
