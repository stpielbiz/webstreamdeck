# Instant menus: local library + guide cache with background sync

## Goal
After the first login, Live TV, Movies, Shows and the guide open instantly from data saved on the device. Updates happen quietly in the background, and moving up/down through menus has no lag.

## What the user will see
- **First time:** a small "Preparing your library…" progress note on TV Home while channels, movies, shows and the TV guide download. Browsing works meanwhile.
- **After that:** every menu opens instantly from the saved copy. A background refresh runs at app start and every few hours; only changed categories, titles and guide programmes are replaced.
- **Guide:** the next ~24 hours of listings are saved; the guide reads from the saved copy, so scrolling channels and times needs no waiting.
- **Remote:** holding Up/Down moves smoothly and immediately; content only updates when you stop on an item.

## Implementation
1. **Device storage (IndexedDB)** — replace the current small localStorage cache (5MB limit, too small for EPG) with a device database holding categories, channels, movies, shows and guide programmes per playlist, each with a "last synced" time.
2. **Full guide download** — new server function that fetches the provider's full XMLTV guide (Xtream `xmltv.php`) once, trims it to the next 24h, and returns it compactly. Falls back to the existing batched schedule lookup if the provider has no XMLTV.
3. **Background sync service** — runs after login / app open: loads from device storage first (instant), then fetches fresh data and merges differences (add new, update changed, remove gone, drop expired programmes). Guide refreshes every 4h, library every 12h, plus a manual "Refresh library" option.
4. **Screens read the cache first** — Live TV, Movies, Shows, TV Home and global search seed from the saved data, so no loading spinners when switching menus; remove the 350ms category delay since data is already local.
5. **Remote speed** — make focus moves instant (no smooth-scroll animation on held keys), avoid re-scanning the whole page on every key press, limit drawn rows/tiles to what's on screen (virtualised lists for long channel/title lists), and defer details/preview updates until focus settles.
6. **Verify** — measure menu open time and key-press-to-focus time before/after at Fire TV size; check first-sync and repeat-sync behaviour.

## Technical notes
- Storage: `idb-keyval`-style IndexedDB wrapper; keys `playlistId:kind:...`. Works in the Fire TV WebView with no native change needed (website update only).
- XMLTV parse server-side with streaming/regex to stay within Worker limits; response chunked per channel batch if large.
- React Query hydrated from IndexedDB (`initialData` + background `refetch`), staleTime raised accordingly.
- `use-spatial-nav.ts`: cache focusable list per zone, use `behavior: "auto"` scroll, throttle repeat keys via rAF.
- Virtualisation with `@tanstack/react-virtual` for guide rows and category/title lists.
