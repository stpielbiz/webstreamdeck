# Correct Home, Sections, and Back navigation

The installed TV experience currently mixes two navigation systems. The TV Home sends **Guide** to the regular `/guide` screen, and that screen’s **Sections** button returns to the regular `/dashboard` page. Playlists, Download, and Admin also leave TV mode. Navigation will be made consistent so the Fire TV app always returns to its own `/tv` Home, while regular browser screens continue returning to `/dashboard`.

## Canonical destinations

```text
TV mode:      /tv → /tv/guide, /tv/live, /tv/movies, /tv/series, /tv/favorites
Web mode:     /dashboard → /guide, /live, /movies, /series, /favorites
```

- Add a proper `/tv/guide` screen using the existing guide data and a TV-friendly wrapper.
- Update both the TV section menu and the TV Home preview button so **Guide** opens `/tv/guide`.
- Keep every **Sections** action inside `/tv/*` returning to `/tv`.
- Keep every **Sections** action on regular screens returning to `/dashboard`.

## Shared pages opened from TV

- Preserve TV context when opening Playlists, Download, or Admin from the TV Home.
- Give those screens a clear, remote-focusable **Back to TV Home** action when entered from TV mode.
- Return to the normal web Home when those pages are opened from the regular app or public site.
- Keep Admin visible only to the authorized admin account.

## Deterministic Back behavior

- Replace browser-history Back behavior on TV movie and episode playback pages with an explicit return destination.
- Return playback opened from TV Home to `/tv`; return playback opened from TV Favourites to `/tv/favorites`; otherwise return to the appropriate Movies or Shows browser.
- Ensure dialogs close first, then category/content layers step back, then Sections returns home.
- Keep the remote focus on the section or item that led to the next screen where practical.

## Implementation approach

- Extract the guide body into a reusable component so `/guide` and `/tv/guide` share the same guide data and behavior without duplicating logic.
- Add a small, validated navigation-context search value for shared Playlists, Download, and Admin screens instead of relying on browser history.
- Update the shared section definitions and all TV Home preview links to use the TV destinations.
- Audit every app link, button, and Back handler for accidental `/tv` ↔ `/dashboard` switching.
- Update the project navigation rule in `AGENTS.md` and track the completed audit in `roadmap.md`.

## Verification

- From `/tv`, open every menu item and use remote Back/Sections; each returns to `/tv` without showing the regular dashboard.
- Specifically verify `/tv` → Guide → Sections → `/tv`.
- Verify Movies, Shows, Live TV, Favourites, Playlists, Download, and Admin follow the same rule.
- Verify regular browser navigation still returns to `/dashboard`.
- Verify direct links, empty-playlist states, playback pages, and admin visibility.
- Test at 1280×720 with D-pad keys and confirm focus does not escape or land on the wrong page.
