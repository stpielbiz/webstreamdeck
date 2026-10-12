# Fix remote navigation in Settings

## Why it skips the toggles
Settings uses the remote's "ordered rows" navigation for some controls (TV display size buttons, the details Update/Stop buttons) but not others (the two on/off switches and "Update now"). When you press Down from a row, the remote jumps straight to the next row — the details update — and passes over the switches in between. Pressing Up has the same problem in reverse.

## Fix
Put every Settings control in its own row, in the order shown on screen:
1. Back to TV Home
2. TV display size (Large / Medium / Small — Left/Right moves between them)
3. Sync my playlists switch
4. Background updates switch
5. Movie & show details: Stop (while running) / Update details now
6. Update library & TV guide: Update now

Up/Down then moves one setting at a time, never skipping, and Left/Right stays within a setting's buttons.

## Technical details
- `src/routes/_authenticated/settings.tsx`: add `data-remote-row` wrappers around the Back link, each `Switch`, and the "Update now" button. Ordered-row navigation in `use-spatial-nav.ts` already walks `[data-remote-row]` in DOM order, so no change is needed there.
- Verify with a Playwright run that presses Down from Back through every control and confirms focus lands on each switch.
