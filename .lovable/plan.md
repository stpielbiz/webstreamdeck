# Fix press-and-hold to favourite channels

## Why it fails
- On the Fire TV guide, the remote focuses the programme boxes next to the channel name, not the channel name itself. Only the channel name has the hold behaviour, so holding OK on a programme box just plays the channel.
- Even where hold exists, pressing OK triggers "play" the instant the button goes down (before the 600 ms hold can finish), so the stream starts first.

## Fix
1. Change the shared hold helper so OK decides on release:
   - OK pressed: start the hold timer and block the immediate "play".
   - Released before ~600 ms: play the channel (normal quick press).
   - Held past ~600 ms: toggle favourite, and ignore the release — no playback.
   - Mouse/touch keep working the same way.
2. Mark held elements so the remote navigation's own OK handling skips them (it currently also activates on key down).
3. Apply the hold to every focusable guide target per channel: programme boxes and the "No programme information" box, plus the existing channel name button and Favourites list rows.
4. Keep the toast confirmation ("Added/Removed … from favourites") and the star on favourite channels.

## Technical details
- `src/lib/use-long-press.ts`: accept `{ onPress, onLongPress }`; on Enter keydown `preventDefault()` (suppresses native button click) and start timer once (ignore repeats); on keyup call `onPress` if not fired; return `data-long-press` attribute.
- `src/lib/use-spatial-nav.ts`: Enter handler skips activation when the active element has `[data-long-press]`.
- `src/routes/_authenticated/tv.live.tsx`: `ProgrammeCell` and the empty-programme button use the hook with `onPress=playChannel`, `onLongPress=toggleChannelFavorite`.
- `src/routes/_authenticated/live.tsx`, `src/components/favourites-lists.tsx`: migrate to the new signature.
- Verify with a Playwright run simulating a held Enter (keydown repeats, keyup after 800 ms) and a quick press.
