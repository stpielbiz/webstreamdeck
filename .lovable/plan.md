# Playlists screen: reliable remote navigation

## What changes for you
- Opening Playlists puts focus straight on the **Edit** button of the first playlist (or on **Add a source** if there are none).
- Only these buttons can be highlighted on the list: **Use**, **Edit**, **Delete** and **Add a source**. The playlist cards themselves, the title and the on-screen "Back to TV Home" button are skipped.
- **Left / Right** moves between Use, Edit and Delete on the same playlist.
- **Up / Down** moves to the same kind of button on the playlist above or below (falling back to the nearest button), and from the last playlist down to **Add a source**.
- The remote **Back** button still returns to TV Home (and goes back one step inside the add/edit flow).
- The add/edit steps (choose type, details, result, delete confirmation) get the same predictable Up/Down/Left/Right movement between their buttons and fields.

## Technical details
- `playlists.tsx`: add its own keydown handler (capture phase, calls `preventDefault`/`stopPropagation`) that navigates a row/column grid built from `[data-pl-row][data-pl-col]` attributes on Use/Edit/Delete/Add buttons, so it no longer relies on the generic geometric search that fails on this page.
- Remove `data-tv-focus` from the visible Back button on the list step; keep a hidden `data-layer-back` element so native/remote Back still works. Other steps keep a Back button but outside the arrow-key order.
- Initial focus: retry `requestAnimationFrame` focus until playlists have loaded (they arrive after first render), targeting the first row's Edit button.
- Other steps: linear Up/Down + Left/Right ordering over `[data-pl-step-item]` in DOM order; text inputs keep Left/Right for the cursor.
- Publish afterwards so the Firestick picks it up.
