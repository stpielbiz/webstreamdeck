# Fire TV live guide redesign

## Goal
Make Live TV easy to browse with a Firestick remote and ensure every channel is reachable.

## Changes
- Replace the current player-plus-sidebar layout with a wide electronic programme guide inspired by the supplied screenshot.
- Keep the selected channel preview and programme details across the top, with a compact horizontal category strip.
- Show channels in a full-width scrolling list with channel number/logo/name and now/next programme columns.
- Make Up/Down move through every channel, Left/Right move between guide actions, and OK play the selected channel.
- Keep remote focus visible, automatically scroll the focused channel into view, and remove the fixed visible-channel limitation.
- Adapt the same screen for narrower mobile browsers without clipping controls or text.

## Validation
- Test remote-key navigation through more than one screen of channels.
- Check the layout at TV and mobile widths.
- Confirm selecting a channel starts playback and the current row remains visible.
