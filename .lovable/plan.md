# Settings: "Update my library & guide", plus fix cut-off menu highlight

## 1. Update library & guide (Settings)
- New card in Settings: **Update library & TV guide**. It says: "Deletes the saved channels, movies, shows and TV guide on this device and downloads fresh copies from your playlist."
- Pressing **Update now** clears the saved copy for the active playlist and starts a fresh download straight away.
- You can leave Settings right away. The download keeps going in the background while you browse (it runs in the app, not on the Settings page).
- Progress shows on the card when you're on Settings ("Channels… Movies… Shows… Guide 120/400"), and a small "Library updated" notice appears when it's done.
- Your favourites, watch history and the shared title details (posters, cast) are not touched.
- This is also the quickest fix for the "All 3000" count: it forces your Movies and Shows lists to download again in full.

## 2. Menu highlight cut off
- The yellow outline on the focused category (e.g. Comedy) is clipped on the left and right because the category list hides anything outside its edges.
- Add a little inner space to the category list in Movies, Shows and Live TV (and the TV home menu if it has the same problem). The outline then fits fully, and the buttons are slightly narrower so nothing overflows.

## Note
The Firestick loads the **published** site. The earlier "no 3,000 limit" fix and these changes only reach the Firestick after you publish.

## Technical details
- `device-cache.ts`: add `clearPlaylistEntries(playlistId)` that deletes IndexedDB entries whose `queryKey` contains the playlist id (keys `tv-live-categories`, `tv-live-items`, `system-catalogue`, guide store, `global-search-*`), skipping `cached-title-metadata`.
- `library-sync.tsx`: add a small module store (`requestLibraryRefresh(playlistId)` + `useLibraryRefreshStatus()`); `useLibrarySync` (mounted in `PlaylistProvider`, so it lives across routes) listens for the request, `removeQueries` for those keys, ignores TTLs for the run, refetches everything including the full guide, and reports phase/progress. Toast via sonner on completion.
- `settings.tsx`: new card with the button (`data-tv-focus`), disabled while running, and the progress text.
- Rail containers in `catalog-workspace.tsx`, `live.tsx`/guide rail, `tv.index.tsx` SectionMenu: add `p-1` (or `px-1 py-1`) to the scrolling container so `ring`/outline isn't clipped by `overflow-hidden`.
