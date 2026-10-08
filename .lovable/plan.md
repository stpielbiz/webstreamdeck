# Background title updates, actor search, and playlist sync

## 1. Slow background update of titles + cast

**What the user gets**
- While browsing, the app quietly fills in missing details (categories, year, poster, and now **cast**) for movies and shows, a few at a time, without slowing menus.
- Movie/show details windows show the main actors.
- Every search box (home global search and Movies/Shows search) also matches actor names, e.g. "Tom Hanks" lists his movies in your playlist.

**How it works**
- After the library sync finishes, a low-priority loop picks titles that have no saved details yet (or saved before cast existed) and resolves them in small batches (about 20 every ~15 seconds), pausing while a video plays.
- Available to every user, not only admin — results go into the shared title details store, so each title is only looked up once for everyone.
- Cast comes from the movie database (TMDB) when it finds the title; otherwise the AI fallback supplies top-billed actors.

## 2. Sync my playlists (resume across playlists)

**What the user gets**
- New **Settings** page (linked from the menu on TV and web) with a switch: **"Sync my playlists"** — "Continue watching follows you across your playlists. If you start a movie or episode on one playlist, you can resume it at the same spot on another playlist that has the same title."
- When on: Continue watching shows items from all playlists; opening one while a different playlist is active finds the same title (matched by cleaned name + year, episodes by show + season + episode) in the current playlist and resumes at the saved position. If it isn't there, a message says "Not available on this playlist".
- Starting the same movie on another playlist also picks up the saved position.
- Off by default; the setting is saved to the account, so it applies on every device.

## Technical details

- Migration:
  - `title_metadata`: add `cast_names text[] not null default '{}'` and `cast_checked boolean not null default false`; GIN index on `cast_names`.
  - New `user_settings` table (`user_id uuid primary key`, `sync_playlists boolean default false`, `updated_at`), GRANTs to authenticated/service_role, RLS own-row select/insert/update.
- `metadata.server.ts`: TMDB lookup also calls `/credits` (top 8 cast); AI prompt returns `cast`. `resolveTitles` re-resolves rows where `cast_checked = false`.
- `metadata.functions.ts`: new `backfillTitles` (auth, non-admin, max 20 names, rate-limited by only accepting names not yet resolved) and `getCachedTitleMetadata` returns `cast`. `TitleMetadata` gains `cast: string[]`.
- `library-sync.tsx`: background backfill step after sync, idle-scheduled, skips while playback active; merges results into the `cached-title-metadata` query (persisted on-device).
- Search (`GlobalSearch`, `catalog-workspace.tsx`): match title OR any cast name from cached metadata; show "with <actor>" hint on actor matches.
- Settings: `src/routes/_authenticated/settings.tsx` (+ `mode=tv` back button convention); `getSettings`/`saveSettings` server functions.
- Sync: `listProgress` unchanged; new `findSyncedProgress({ title, kind, season, episode })` returns the most recent progress across playlists by normalised title. Playback routes use it for start position when sync is on; Continue watching resolves cross-playlist items via the active playlist's catalogue (shared `normTitle` from `top10-rows.tsx` moved to a util).
- Save memory note for the sync setting; AGENTS.md rule for background backfill.
