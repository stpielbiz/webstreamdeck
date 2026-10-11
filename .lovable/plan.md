# Keep show/movie details linked to the playlist (no more dropping to 0%)

## What's happening
The title details themselves are safe in the shared database. What gets lost is the copy **on the device** that links each playlist title to those details. From the code, the likely causes are:
- The saved link list on the device is thrown away after 7 days, and is filed under the library's title count — so when a few shows are added or removed, the old list no longer applies and the status falls back to 0% until it's rebuilt.
- The rebuild runs only once per session, and if it fails quietly the status stays at 0%.
- Titles are matched by their exact provider name, so a small rename by the provider breaks the link even though the details exist.

The first step is to confirm which of these happened on your device.

## Changes
1. **The link never expires.** Saved details for a playlist stay on the device until you press "Update now" in Settings or delete the playlist.
2. **Only differences are processed.** When the library refreshes, removed titles lose their link, new titles are looked up in the database, and everything else stays as it is. This runs automatically in the background.
3. **Match by cleaned title, not exact name.** Titles are linked using the same cleaned title key the database uses, so provider renames (quality tags, episode text, year brackets) keep their details.
4. **Fast lookups.** New titles are checked against the database in large batches in parallel, so thousands of titles take seconds, not minutes.
5. **Retry on failure.** If a lookup fails, it tries again shortly instead of leaving the status at 0%.
6. **Check:** the status stays at the same % after a restart and after a library refresh, and only new titles show as pending.

## Technical details
- `device-cache.ts`: exempt `cached-title-metadata` from `MAX_AGE`.
- `catalog-workspace.tsx`: metadata query key drops `names.length` → `["cached-title-metadata", playlistId, kind]`; queryFn fetches only names missing from the existing map, prunes names no longer in the catalogue, merges.
- `useTitleBackfill` summary: same delta logic on every catalogue change (not once), retry with backoff on error.
- `useLibraryOverview`: count coverage by `lookupKeyFor(name).key` against a key-indexed map, so renamed variants still count.
- `getCachedTitleMetadata`: raise chunk from 200 to 500 keys and parallelism to 12; allow 10,000 names per call.
