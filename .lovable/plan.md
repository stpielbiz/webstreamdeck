# Make Franchise open instantly and go back quickly

## What the logs show
You pressed OK on Franchise at 20:39:31. The first remote press didn't reach the posters until 20:40:16, so the screen was frozen for about **45 seconds**. Then all the presses you made while it was frozen came through at once, a few milliseconds apart.

## Why
- Each poster sorts and groups your **whole movie and show library** (about 14,000 titles) by itself. With 5 posters, the Fire Stick does that heavy job 5 times before anything appears. Opening a collection does it again, and Back does it again for every poster, which is why going back is slow too.
- The library is also asked for again from your provider instead of using the copy already saved on the device.

## What changes
1. **Posters appear right away.** The wall shows straight away with names and placeholder posters. The artwork and "8 of 12 in your library" fill in a moment later, without blocking the remote.
2. **Matching is done once.** The library is grouped once and only for the titles in your saved franchises, not the whole catalogue. The result is kept, so opening a collection and pressing Back don't redo it.
3. **Uses the saved library.** Franchise reads the library already saved on the device, like Movies and Shows do. It only asks the provider when nothing is saved yet.
4. **Back is instant.** The poster wall stays loaded behind the collection page instead of being rebuilt, and the highlight returns to the poster you opened.
5. **Logs:** add a "Franchise ready in X ms" line so we can confirm the speed on your Fire Stick.

## Technical details
- New shared hook `useFranchiseIndex(movies, shows)` in `franchise-details.tsx`: builds the matchKey→groups map once per catalogue (memoised, module-level cache keyed by array identity), computing groups only for items whose key is among all saved members' keys. `useFranchiseMatches` then does map lookups.
- `saved-franchise-browser.tsx`: compute matches for all cards in one deferred pass (`useDeferredValue` / idle slice via `background-gate`), pass results to `PosterCard`. Keep the grid mounted (hidden) while `FranchiseCollectionPage` is open.
- Catalogue source: the device-cached library (`device-cache.ts` / `useLibrarySync`) as `initialData` for the `system-catalogue` queries.
- `debugLog("franchise", "ready", { ms })`.
- No database changes.

## Verification
- Signed-in preview at Fire TV size: time from opening Franchise to the first focusable poster, then open and close a collection and check focus comes back to the same poster.
- After you publish, check the "Franchise ready" log line on the Fire Stick.
