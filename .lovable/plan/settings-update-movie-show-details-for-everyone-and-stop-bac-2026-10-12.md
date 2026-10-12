# Settings: update movie/show details for everyone, and stop background updates

## What the user will see (Settings)
1. **Update movie & show details** card
   - Button **Update details now** — runs the same full details update admins have in the TV home menu (genres, posters, description, cast) for the current playlist.
   - Text before starting: "This can take a while for large libraries. Please wait on this screen until the update is done for the best result."
   - While running: progress ("Movies 4,200 / 15,000 · Shows 900 / 2,500"), a **Stop** button, and a reminder "Please wait until the update is done." A "Details updated" notice appears at the end.
   - Admins keep their existing button on the TV home menu; it now uses the same update.
2. **Background updates** card
   - Switch **Background updates** (on by default). Turning it off stops all automatic work right away: library/guide refresh, slow details backfill, and any running details update.
   - When off, the app uses only what is already saved on the device. Manual buttons ("Update now", "Update details now") still work when pressed.
   - The choice is saved to the account so the Firestick and browser follow it.

## Technical details
- `metadata.functions.ts`: new `refreshTitles` server fn (requireSupabaseAuth, verifies playlist ownership via RLS, batch max 50, calls `resolveTitles` with admin client). Keep `adminRefreshTitles` as-is or point admin UI to the new fn; batch size/concurrency for non-admins kept modest (40 per batch, 2 workers) to protect TMDB/AI limits — cached titles return instantly.
- `library-sync.tsx`: `runBulkRefresh` takes the server fn as a parameter; usable from Settings; existing global state/progress hook reused.
- Migration: `user_settings.background_updates boolean not null default true`. `settings.functions.ts` reads/saves it alongside existing fields; `playlist-sync.ts` exposes `useBackgroundUpdates()`.
- `playlist-context.tsx`: pass the flag to `useLibrarySync` and `useTitleBackfill`; both skip scheduled/automatic runs when off (manual `requestLibraryRefresh` still runs). Turning off calls `stopBulkRefresh()`.
- `settings.tsx`: two new cards with `data-tv-focus` buttons in remote rows.
