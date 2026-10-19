<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Native Fire TV app lives in `native-app/android/` (Kotlin WebView + Media3 player, JS bridge `window.StreamDeckNative`) and is built by `.github/workflows/android.yml` — providers block server/browser playback, so device-side playback is required.
- Movies/Shows: persistent 20/80 category/content browsing, zone-bound focus — deterministic remote nav.
- Selecting a Movie or Show opens a compact modal with details and preview playback; remote Back closes it before leaving the section.
- Device pairing uses the public `/device-login` entry screen and returns there after authentication; legacy Firestick and TV-specific links redirect to it. Signed-out Fire TV goes to `/tv/pair` via `signedOutPath()`.
- The TV home uses a persistent menu/details workspace: focus previews a section, OK opens it, and content rows remain independently remote-navigable.
- Remote focus uses a shared inset :focus indicator and action-only targets; rows navigate by order, dialogs isolate focus — reliable selection. A control drawing its own focus look opts out with `data-focus-glow`.
- Continue watching uses horizontal shelves; Home and Favourites share compact three-column channel/movie/show lists with action-only row focus and shared title dialogs.
- Native app checks GitHub releases at launch/on request; installs via Android's user-approved installer — secure in-app upgrades.
- Navigation preserves device mode: TV routes and TV-opened shared screens return to `/tv`, while regular browser screens return to `/dashboard` — keeps remote users out of the desktop shell.
- Live TV is the single guide destination and uses a persistent category rail with a horizontally navigable programme timeline — no duplicate Guide.
- Native Back is consumed once on key release and routed to the site's layer-aware handler; player close and completion have separate callbacks — no skipped layers.
- Library data is persisted on-device in IndexedDB (device-cache.ts), refreshed by useLibrarySync; heavy saves/sync/backfill wait on `background-gate.ts` (player, remote idle) and yield in slices — Fire Stick main-thread stalls froze the remote.
- Movies and Shows use shared route and catalogue loading placeholders only when saved data is unavailable — cold fetches get feedback without hiding cache.
- TV section links show an immediate opening overlay until navigation unmounts the menu — remote clicks get feedback without depending on router pending-state timing.
- Title details (genres, artwork, cast) are backfilled slowly in the background by `useTitleBackfill` into the shared `title_metadata` store — every user contributes, each title is resolved once, and browsing never waits on it.
- Cross-playlist resume is opt-in per account (`user_settings.sync_playlists`) and matches titles by normalised name (+ season/episode) through `src/lib/playlist-sync.ts` — provider item IDs differ between playlists.
- Catalogues cache raw provider entries and derive grouped titles with selectable stream variants — hides duplicate quality copies, keeps playable IDs.
- Franchise lists are resolved once per title key into the shared franchise_lookups table and matched to catalogues on-device — avoids repeat AI lookups.
- All title details entry points use the shared inline franchise panel and a title history within one dialog — related titles keep variant selection and Back returns to the previous title without stacking dialogs.
- Saved franchise collections are account-owned and the Franchise navigation is conditional on at least one saved collection — empty accounts are not given a dead-end menu.
- All search inputs use the shared SearchField with local draft state and confirmation on Enter, blur or keyboard dismissal; native Back is consumed before page navigation — no per-letter requests.
- Fire TV display density is an account setting applied through the shared TV shell and root sizing selectors, never browser zoom — stable focus geometry.
- Account expiry is stored separately from roles; expired accounts retain only Home, Settings, and sign-out access.
- Provider calls use `device-provider.ts` hooks: Fire TV runs `iptv-provider.ts` on-device via `StreamDeckNative.fetchText`, else server — providers often blank our servers.
- Multi-view: one player per screen; Recents capped at 10/playlist.
- Recordings are device-only: native `RecordingManager` (foreground service + alarms) saves .ts files and its index on the Fire TV; web reads them via bridge — browsers can't record in background.
- Player recents bar: `StreamDeckNative.setRecentChannels` feeds it; Down toggles, OK switches (reports `__streamDeckChannelSwitched`). Live-only: VOD keeps Down for seeking.
- Public homepage copy, actions and feature cards live in src/content/homepage.ts — edit content without touching layout.
