# Make "All" pick up the full library (no more 3,000)

## Cause (confirmed in the code)
The 3,000 limit has been removed, but your device still has the old list saved, which was cut off at 3,000. The app treats a saved list as current for **12 hours**, so it keeps showing the old copy and doesn't download a new one. That's why the count isn't changing.

## Changes
1. **Throw away cut-off saved lists.** Add a version stamp to the saved Movies and Shows lists. Lists saved before this fix, or any list with exactly 3,000 titles, are treated as out of date and downloaded again right away in the background.
2. **Counts update live.** When the new list arrives, the number next to "All" and next to each category update immediately, without leaving the screen.
3. **Show it's working.** While the Movies or Shows list is refreshing, a small "Updating library…" label appears next to the category heading.
4. **Check:** after opening Movies, "All" goes past 3,000 and matches your provider's total.

## Technical details
- `device-cache.ts`: add `CACHE_VERSION = 2` in each entry. On restore, skip `system-catalogue` entries whose version is older or whose data length is exactly 3000.
- `library-sync.tsx`: the `refresh` check for `system-catalogue` also treats `length === 3000` as stale.
- `catalog-workspace.tsx`: use `catalogue.isFetching` to show the "Updating library…" label. Counts already come from `catalogue.data`, so they update when the cache is replaced.
