# Featured row swap on Movies/Shows

## Goal
The top of the Movies/Shows screen shows one featured row at a time. "Popular here" is the default; clicking "Top 10 Netflix" or "Top 10 Prime" in the category list replaces the top row with that chart only (no more stacking of all three).

## Changes

1. **Featured state** in `src/components/catalog-workspace.tsx`
   - New state `featured: "popular" | "netflix" | "prime"`, default `"popular"`.
   - The content area renders only the selected featured row at the top: `PopularRow` when `"popular"`, otherwise the matching Top 10 row. Category titles, search, and sort stay underneath unchanged.
   - While searching, the featured row keeps its current behavior (hidden during search results, as today).

2. **Single-service Top 10 row** in `src/components/top10-rows.tsx`
   - Add a `service` prop so the component renders just one chart ("netflix" or "prime") instead of both. Tile rendering (rank badge, greyed "Not in your list") stays the same.

3. **Category rail buttons**
   - "Popular here" sets `featured` back to `"popular"`, scrolls to top, focuses the first popular tile.
   - "Top 10 Netflix" / "Top 10 Prime" set `featured` to that service, scroll to top, and focus the first tile; if none of that chart is in the playlist, keep the existing toast and don't switch.
   - The active featured button is highlighted (secondary variant) so the user can see which row is showing.

## Notes
- Website-only change; the Fire TV app picks it up without a rebuild.
- No changes to how charts are fetched or cached.
