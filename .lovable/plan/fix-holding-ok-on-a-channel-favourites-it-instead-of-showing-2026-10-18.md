# Fix: holding OK on a channel favourites it instead of showing the menu

## What is happening
Your Fire Stick already has the new menu, but it flashes open and closes again straight away. The menu opens while you are still holding OK, and its first option, "Add to favourites", is already selected. When you let go of OK, that release counts as pressing "Add to favourites". The channel gets added and the menu closes before you can see it.

## The fix
- When the menu opens from a hold, it ignores OK until you have let go of the button. After that, the next OK press chooses an option as normal.
- Safety net: for the first half-second after the menu opens, a stray press can't pick an option.
- The menu opens with the selection on the title area, not on "Add to favourites". Press Down to reach the options, so one press can't add the channel by accident.
- This applies everywhere the menu opens: the channel name, programme boxes, and "No programme information" rows in Live TV, plus the website's Live TV list.

## Technical details
- `src/components/channel-action-menu.tsx`: add an `armed` state that is false on open. A window keyup listener (capture phase) for Enter/Space/Select sets it to true, and a 500 ms timer also sets it to true as a fallback. While unarmed, use `onKeyDownCapture`/`onClickCapture` on DialogContent to preventDefault and stopPropagation on activation keys and clicks. Use `onOpenAutoFocus` to focus a non-action heading container (tabIndex -1) instead of the first button.
- `useLongPress` stays the same. The dialog absorbs the leftover release itself.
- Verify in a browser: simulate holding Enter on a channel cell (repeated keydowns, then keyup), confirm the menu stays open with no favourite toast, then confirm Down + OK still toggles the favourite.
- Publishing the website delivers the fix. No app update is needed.
