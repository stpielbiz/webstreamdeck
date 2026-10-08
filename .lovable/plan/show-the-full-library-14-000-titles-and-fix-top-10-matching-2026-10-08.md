# Show the full library (14,000+ titles) and fix Top 10 matching

## What's wrong (found in the code)
- The server stops sending titles after the first **3,000** for every list (`fetchItems` ends with `slice(0, 3000)`). So "All", search, and Top 10 matching only ever see 3,000 of your movies.
- Title details (categories, posters) are only requested for the first **5,000** names.
- Each group on screen draws at most **180** tiles.
- Netflix's chart names shows like "Wednesday: Season 2" or "Adolescence: Limited Series". Our matching keeps that suffix, so the show isn't recognised even when you have it.

## Changes
1. **No limit on movies/shows lists.** Remove the 3,000 cap for movie and series lists (keep a cap only for search-as-you-type on Live TV channels, which is unaffected). The full list is already saved on the device, so this costs nothing after the first load.
2. **The saved copy goes to the device store, not browser storage.** Movies/Shows currently also save the list in a small browser store that silently fails above ~5 MB (14,000 titles is bigger). Use only the device library cache, which has no such limit.
3. **Details for every title.** Request saved details in chunks of 5,000 and merge them, so categories and posters cover the whole library.
4. **Scroll through everything.** Each group shows 180 tiles, then a **Show more** tile at the end (remote friendly) that adds the next 180. Search results also use Show more.
5. **Better Top 10 matching.** Strip "Season N", "Part N", "Limited Series", "Volume N" and similar suffixes, then match on the cleaned title (with year as a tie-break). Also compare against the corrected title from saved details, not only the provider name.
6. **Check:** count the titles in "All" against your provider's total and confirm a show from the Netflix chart now matches.

## Technical details
- `iptv.server.ts` `fetchItems`: apply `slice(0, 3000)` only when `kind === "live"` and a search is given.
- `catalog-workspace.tsx`: drop `writeCache`/`readCache` for catalogue+metadata (IndexedDB `device-cache` already persists `system-catalogue` and `cached-title-metadata`); `names` no longer sliced; metadata `queryFn` loops chunks of 5,000 calling `getCachedTitleMetadata`; per-section `limit` state with a "Show more" `PosterTile`-style button (`data-tv-focus`).
- `top10-rows.tsx` `normTitle`: also remove `:\s*(season|series|part|volume|vol\.?|chapter|limited series|miniseries)\b.*$`; build the index from both `item.name` and `metadata[item.name]?.title` (pass metadata in as a prop).
