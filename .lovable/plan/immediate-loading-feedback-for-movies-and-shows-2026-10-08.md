# Immediate loading feedback for Movies and Shows

## Goal
When Movies or Shows takes a few seconds to open, show an immediate, polished loading state so the remote click feels acknowledged and the user never sees a frozen screen.

## What will change
1. **Instant transition feedback** — as soon as the user selects Movies or Shows, replace the content area with a TV-friendly loading view containing a subtle spinner and the destination name, such as “Opening Movies…”. Keep it visible until the next screen is ready.
2. **Catalogue-shaped loading state** — on the destination screen, show lightweight placeholders for the category rail and title grid while uncached catalogue data is arriving. If saved device data is already available, render it immediately instead of showing the loader.
3. **Faster repeat navigation** — preload the Movies or Shows screen when its Home menu item receives focus, without fetching the full provider library again. Existing on-device catalogue and guide caching remains the source of instant repeat visits.
4. **Accessible motion** — keep the animation restrained, preserve remote focus behavior, and disable nonessential movement when reduced motion is enabled.
5. **Verify the flow** — test Home → Movies, Home → Shows, Movies ↔ Shows, and Back on both cold and cached visits; confirm the loading state appears promptly and never gets stuck after an error.

## Technical details
- Add route-level pending UI for both browser and TV Movies/Shows routes, because the current routes have no `pendingComponent`; their existing catalogue skeletons only appear after navigation has already completed.
- Use the existing semantic colors, `Loader2`, and Skeleton components so the state matches Stream Deck.
- Add intent/focus preloading to the existing navigation links rather than introducing another data-fetch path.
- Do not change provider playback, catalogue contents, EPG syncing, or the local IndexedDB cache.
