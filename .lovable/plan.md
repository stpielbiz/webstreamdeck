# Better Franchise menu: posters, grouped list, instant play

## What you will see

1. **Poster wall.** Opening Franchise shows one large poster per saved collection, with its name and "8 of 12 in your library" underneath. The poster is from the newest title in the collection that has artwork. Remove stays as a small button under each poster.
2. **Click a poster → collection page.** Opens a full page (not a small window) for that collection, grouped into:
   - **Movies** — every movie in release order.
   - **Shows** — each show with its seasons listed under it (Season 1, Season 2…), each with its episodes.
3. **Progress shown right away.** Every movie, season and episode shows a progress bar where you left off, or a "Watched" mark when finished. Seasons show "5 of 10 watched". Titles not in your playlist are greyed with "Not in your list".
4. **No preview, plays straight away.**
   - Movie: starts playing from where you stopped (or from the start).
   - Show heading: plays the episode you were on, or the next unwatched one.
   - Episode: plays that episode.
   Back from the player returns to the same spot in the collection page; Back again returns to the posters.
5. Works the same on Fire TV and the website. Remote: Up/Down through rows, OK plays.

## Technical details
- `src/components/saved-franchise-browser.tsx`: replace cards with a poster grid; poster = newest matched member (`useFranchiseMatches`, highest year with `group.item.image` or metadata poster). Local state `openId` switches to a new `FranchiseCollectionPage` component (replaces the `FranchiseList` dialog here only; the inline franchise panel in title details is unchanged).
- New `src/components/franchise-collection.tsx`: Movies section from matched movie groups; for each matched show, fetch seasons via `useGetSeries` (cached query, loaded when the page opens). Progress via `progressForVariants` / `completedForVariants` and episode rows matched by item id.
- Playback: TV routes navigate to existing `/tv/watch/movie/$id` and `/tv/watch/series/$id` (with episode) using the best variant; browser opens the shared player directly. Resume position from `findResume`.
- Back handling: page Back button uses `data-layer-back`; focus restored to the last played row via `data-focus-key`.
- No database changes.

## Verification
- Preview at Fire TV size: posters render with newest artwork, opening a collection shows Movies and Shows→Seasons with progress, OK starts playback without a details window, Back returns to the same row.
