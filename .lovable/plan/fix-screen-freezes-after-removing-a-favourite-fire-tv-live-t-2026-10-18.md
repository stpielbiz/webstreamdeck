# Fix: screen freezes after removing a favourite (Fire TV Live TV)

## Likely cause (unconfirmed on a real device)
When you remove a channel from favourites through the hold menu, the channel is removed from the list right away. When the menu closes, the guide tries to put the selection back on that same channel, but the channel is no longer there (for example, inside the Favourites category). The selection ends up nowhere, so the remote arrows and OK seem to stop working, and the screen looks frozen.

## Fix
1. Before removing it, note where the channel sits in the list. When the menu closes:
   - put the selection on the channel that took its place (or the one above it if it was the last one);
   - if the list is now empty, put the selection on the current category in the left rail.
2. Do the same for favourite categories: when you remove a pinned category and it leaves the top of the rail, the selection goes to the category next to it.
3. Safety net for the whole TV app: if the selection is ever lost (nothing selected), the next arrow press selects the first item in the current area instead of doing nothing.
4. Apply the same handling on the website's Live TV page.

## Check
- Use a test playlist with fake channels in a real browser: open Favourites, hold OK, remove a channel, and check that the arrows still move and OK still works. Repeat for the last channel and for the only channel.
- Remove all test data afterwards. No Fire TV app update is needed; publishing the website is enough.

## Technical details
- `tv.live.tsx`: `restoreChannelFocus` falls back to the neighbour index recorded at menu open, then to `[data-focus-key="category-<active>"]`; the dialog's `onCloseAutoFocus` calls preventDefault so Radix does not try to focus the removed trigger.
- Shared remote navigation handler: when `document.activeElement` is `body`, an arrow key focuses the first `[data-tv-focus]` in the active zone.
- Mirror the fallback in `live.tsx`.
