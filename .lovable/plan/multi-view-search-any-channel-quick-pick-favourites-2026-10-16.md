# Multi-view: search any channel, quick-pick favourites

## What you'll see

When you open **Multi-view** in Live TV:

- A **search box** at the top of the picker. Type a channel name and matching channels from your **whole playlist** appear — not just the category you were watching — so you can combine channels from different categories.
- Your **favourite channels listed first** for one-press quick select, followed by recent channels, then everything else.
- Picking works exactly as today: tick 2 to 4 channels, then **Watch N screens**.
- On Fire TV the search box uses the same confirm-on-Enter behaviour as the other search boxes, so typing doesn't fire a request per letter.

## How it works (technical)

- `src/components/multi-view.tsx`:
  - Add a `SearchField` at the top of the picker dialog (local draft, applies on Enter/blur, per the existing search convention).
  - New state `results`: when a search term is active, call the existing `fetchItems` server/device path with `{ playlistId, kind: "live", search: term }` (same call the Live TV pages already use) and show those matches in the list. No new backend work.
  - Without a search term, the list is ordered: favourites of the active playlist first, then recent channels, then the current category's channels (deduplicated, cap raised from 40 to 60).
  - With a search term, the list shows the search matches instead; already-picked channels keep their tick and stay in the summary count even if they scroll out of view.
  - Remote order: search box → channel rows → Cancel/Watch buttons, each in its own `data-remote-row`.
- `src/routes/_authenticated/tv.live.tsx` and `src/routes/_authenticated/live.tsx`: no signature change needed — MultiView already receives `playlistId` and can fetch itself; candidates stay as the fallback list.

## Notes

- Website change only — works on publish, no new Fire TV app update needed.
- Each screen still uses one provider connection, as the dialog already warns.
