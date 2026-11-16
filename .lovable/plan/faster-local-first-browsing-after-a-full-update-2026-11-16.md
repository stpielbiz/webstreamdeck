# Faster, local-first browsing after a full update

## What changes for the user
1. **Home reminder no longer mentions channels.** The card says it saves movies, shows and their details. "Update everything" refreshes only movies, shows and details; the progress line never shows "Channels" or "TV guide".
2. **Channels and the TV guide keep updating quietly in the background** on their normal schedule (channels every 12 h, guide every 4 h), without showing on Home.
3. **After a full update, browsing reads from the device.** Movies, shows, Live TV lists and title details open from the saved copy right away. A server refresh happens only when the saved copy is actually old, and never blocks the screen.

## Step 1 - confirm what still goes to the server (first, before changing code)
Today the saved-on-device copy covers channel lists, movie/show lists, details summaries and the guide. Screens also ask the server for things that are not saved on the device: a show's season/episode list, a movie's info and a single title's details (kept in memory only 10-30 minutes). Live TV categories are kept 30 minutes. I'll open the TV screens after an update and record every server request, so the fix targets the requests that actually slow navigation instead of guessing.

## Step 2 - make those reads local
- Save show episode lists, movie info and Live TV categories on the device next to the rest of the library, and treat them as fresh for 12 hours, like the main lists.
- When something is saved, show it immediately and refresh it in the background only if it's old (still waiting for the remote to be idle, as today).
- Title details: use the saved details first and skip the one-title server lookup when the saved copy already has the title.

## Step 3 - split the full update
- Full update: clear and refetch movies + shows only, then details. Channels/categories/guide are not cleared or refetched.
- Background sync keeps owning channels and the guide.
- Settings "Update library & guide" keeps refreshing everything, as now.

## Checks
- Update the full-update tests: the reminder flow no longer touches channels.
- Add a test that a saved, under-12-hour show episode list is reused without a server call.
- Browser run on the TV screens: after an update, opening Movies, Shows, a show's details and Live TV makes no list/detail server requests.

## Technical notes
- `requestLibraryRefresh` gets a `scope: "titles" | "all"`; the card passes `"titles"`, and `useLibrarySync` skips the live/categories/guide steps and their clearing for that scope.
- Add `series`, `movie`, `tv-live-categories` families to the IndexedDB persistence allow-list in `device-cache.ts`, with `staleTime` 12 h and a long `gcTime`.
- Copy changes are in `full-update-card.tsx`.
