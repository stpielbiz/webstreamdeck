# Fix: Live TV freezes after stopping a channel (Fire TV)

## Likely cause (not yet confirmed on a real device)
When you press Back in the full-screen player, the Fire TV app closes the player, but it only tells the website "the player is closed" when Android finally cleans the player up. Android often does that several seconds later. Until then, the website still shows its own invisible "playing" layer on top of the guide. That layer catches the arrows and OK, so nothing moves, and Back is ignored for a moment too. It looks frozen.

## Fix
1. **Fire TV app (needs an app update):** the player tells the website it closed the moment you press Back (or the channel gives up), not when Android cleans up later. It only does this once, so you never skip a screen.
2. **Website backup (works on publish, no update needed):** when the Fire TV app comes back to the front after the player, Live TV checks whether the player is still open. If not, it closes its "playing" layer straight away and puts the selection back on the channel you were watching.
3. **Arrow-press safety net:** if a "playing" layer is somehow left on screen with no player behind it, the first arrow or Back press closes it instead of doing nothing.
4. The same handling applies to movies and shows, since they use the same player.

## Check
- Use the TV-app test double in a real browser: start a channel, close the player with a delay before the "closed" message arrives, and check that the arrows and OK work right away and the selection is on the same channel.
- On your Fire Stick after publishing (and after the app update): start a channel, press Back, and move straight away.

## Technical details
- `PlayerActivity.kt`: add `notifyClosed()` guarded by a `closedNotified` flag; call it in the Back handler and the give-up path before `finish()`; `onDestroy` calls it only if not already sent. Set `isOpen = false` there too.
- `MainActivity.kt`: `onResume` runs `window.__streamDeckResumed?.()`; bridge exposes `isPlayerOpen()`.
- `video-player.tsx`: register `__streamDeckResumed` + `visibilitychange`/`focus` listeners while native is active; if `StreamDeckNative.isPlayerOpen?.()` is false (or missing and the page regains focus after 1 s), run the same close path as `__streamDeckClosed` (idempotent).
- `use-spatial-nav.ts`: if a `[data-tv-zone="live-player"]` dialog is open while the native player is closed, arrows/Back click its `data-dialog-back`.
