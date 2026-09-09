# TV Streaming App — TiviMate-style Web Player

A site where people sign up, add their own IPTV subscriptions (Xtream Codes login or M3U link), and watch live TV, movies and series in the browser. The app hosts no content of its own — every account brings its own provider details.

## What users can do

1. **Sign up / log in** with email and password, or Google.
2. **Add playlists** — either an Xtream Codes server (URL, username, password) or an M3U link. Multiple playlists per account, each named, switchable from a source picker.
3. **Live TV** — categories, channel list, search, TV guide (now / next, full programme view) where the provider supplies EPG data.
4. **Movies** — poster grid by category, detail page with description and cast info from the provider, play.
5. **Series** — seasons and episode lists, play any episode, next-episode button at the end.
6. **Continue watching** — the app remembers the exact position of every movie and episode and shows a "Continue watching" row on the home screen; resuming picks up where they stopped. Progress is saved per account, so it follows them across devices.
7. **Favourites** — star channels, movies and series; a dedicated favourites view.
8. **Player** — full screen, volume, seek, quality/audio track selection where available, keyboard shortcuts, channel up/down on live TV.

## Order of work

1. Accounts, login/signup, and secure per-user storage.
2. Playlist management (add, name, verify, delete, switch).
3. Live TV browsing and the player.
4. Movies and series libraries with detail pages.
5. Continue watching + favourites everywhere.
6. TV guide.

## Things to know up front

- **Provider reliability drives the experience.** Some Xtream servers are slow or block browser requests. The app fetches everything through our own server so this mostly works, but a provider that is down will show as an error state — that is not an app bug.
- **Some streams won't play in a browser.** Modern HLS streams play fine. Older MPEG-TS-only channels and DRM-protected content cannot be played by any browser player. Affected channels will show a clear "not playable in browser" message rather than a black screen.
- **No content is included.** Users must already have a working IPTV subscription.

## Technical notes

- **Stack**: TanStack Start + React, Tailwind, Lovable Cloud (Postgres + auth) — matches the existing project.
- **Data model** (all RLS-scoped to `auth.uid()`, with explicit grants):
  - `playlists` — id, user_id, name, kind (`xtream` | `m3u`), server_url, username, password, m3u_url, created_at.
  - `favorites` — user_id, playlist_id, item_kind (`live` | `movie` | `series`), item_id, title, logo_url, unique per (user, playlist, kind, item).
  - `watch_progress` — user_id, playlist_id, item_kind, item_id, series_id, season, episode, position_seconds, duration_seconds, updated_at; unique key for upsert.
- **Credentials**: playlist secrets never reach the browser after entry. All provider calls run in `createServerFn` handlers under `requireSupabaseAuth`, which load the row by id and verify ownership before calling out.
- **Provider layer** (`src/lib/iptv.server.ts`): Xtream `player_api.php` actions (categories, streams, VOD info, series info, `xmltv.php` for EPG) plus an M3U/`#EXTINF` parser normalising `tvg-id`, `tvg-logo`, `group-title`. Both normalise into one internal shape so the UI is source-agnostic. Server functions in `src/lib/iptv.functions.ts`.
- **Stream URLs**: signed short-lived playback URL handed to the client, or an authenticated proxy server route for providers that need header/credential injection. Never embed the user's password in a client-visible URL.
- **Playback**: `hls.js` loaded client-only (dynamic import inside `<ClientOnly>`), native HLS on Safari. Unsupported container → explicit unsupported state.
- **Progress**: throttled upsert every ~10s and on pause/unmount; treated as finished past 95%.
- **Routes**: public `/` (landing) and `/auth`; everything else under `_authenticated/` — `/dashboard`, `/live`, `/live/$channelId`, `/movies`, `/movies/$id`, `/series/$id`, `/guide`, `/favorites`, `/playlists`.
- **Caching**: TanStack Query with route loaders; long stale times for category/stream lists (large payloads), short for EPG.

## Design

Dark, dense, remote-friendly TiviMate-like interface. I'll show a few visual directions to choose from before building the UI.
