# Show watch progress in franchise lists

## Goal
In the franchise window (the list of movies/shows in a collection), each title shows a thin bar at the bottom of its row showing how far the user watched it — so it's easy to see which one they were last watching.

## What you'll see
- Each title row in a franchise list gets a slim progress bar along the bottom of the row when you've started watching it.
- A title you finished shows a small "Watched" mark instead of a bar.
- Titles never started show nothing extra.
- Works in both the year order and story order views, on web and Fire TV.

## Technical details
- Move `progressForVariants` out of `src/components/catalog-workspace.tsx` into a shared module (e.g. `src/lib/watch-progress.ts`) so both the catalogue and franchise list use the same matching (variant IDs, series IDs, normalised title) — export it and update the catalogue import.
- In `src/components/franchise-list.tsx` (`FranchiseList`): call `useProgress()` from `@/lib/library-hooks` and get the active playlist from the playlist context; for each matched member compute progress via the shared helper using the member's `group.variants` and title.
- Render the bar at the bottom of the row button: an absolute-positioned track (`bg-muted`) with a filled portion (`bg-primary`, width = progress %), matching the existing `PosterTile` bar style in `src/components/media.tsx`. Completed rows show a small "Watched" label in the subtitle line instead.
- No backend changes; progress data already comes from the existing `listProgress` query.

## Verification
- Run the build; check `/tmp/observability/build-errors.log`.
- Preview: open a franchise containing a partially watched title and confirm the bar appears and matches the catalogue tile's progress.
