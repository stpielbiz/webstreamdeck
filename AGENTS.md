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
- Movies and Shows use sections → persistent 20/80 category/content browsing across TV and web, with zone-bound focus and compact preview playback — this keeps remote navigation deterministic without hiding context.
- Selecting a Movie or Show opens a compact modal with details and preview playback; remote Back closes it before leaving the section.
- Device pairing uses the public `/device-login` entry screen and returns there after authentication; legacy Firestick and TV-specific links redirect to it.
- The TV home uses a persistent menu/details workspace: focus previews a section, OK opens it, and content rows remain independently remote-navigable.
- TV Home library content uses compact horizontal shelves with distinct landscape, channel-logo, and portrait tile formats — this maximizes content density while preserving remote navigation.
- The native Fire TV app checks GitHub release metadata at launch and on request through the JS bridge; manual checks report results and updates use Android's user-approved installer — this preserves device security while enabling in-app upgrades.
- Navigation preserves device mode: TV routes and TV-opened shared screens return to `/tv`, while regular browser screens return to `/dashboard` — this prevents remote users from falling into the desktop shell.
- Live TV is the single guide destination and uses a persistent category rail with a horizontally navigable programme timeline — this avoids duplicate Live TV and Guide workflows.
- Native Back is consumed once on key release and routed to the website's layer-aware handler; player closure has a separate bridge callback from completion — this restores browsing without skipping layers or exiting the app.
- Provider library data (categories, channels, catalogue, guide) is persisted on-device in IndexedDB via src/lib/device-cache.ts and refreshed by useLibrarySync in PlaylistProvider — menus render from saved data instantly and only stale parts are re-fetched.
- Movies and Shows use shared route and catalogue loading placeholders only when saved data is unavailable — cold provider fetches show immediate feedback without replacing cached content.
- TV section links show an immediate opening overlay until navigation unmounts the menu — remote clicks receive feedback without depending on router pending-state timing.
- Title details (genres, artwork, cast) are backfilled slowly in the background by `useTitleBackfill` into the shared `title_metadata` store — every user contributes, each title is resolved once, and browsing never waits on it.
- Cross-playlist resume is opt-in per account (`user_settings.sync_playlists`) and matches titles by normalised name (+ season/episode) through `src/lib/playlist-sync.ts` — provider item IDs differ between playlists.
- Movie/show catalogues keep raw provider entries cached but derive grouped title views with selectable stream variants — this hides duplicate quality copies without losing playable provider IDs.
