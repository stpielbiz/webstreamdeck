# Franchise menu: cards only, easy remote movement

## What changes
- The Franchise poster wall shows only the poster cards. The small remove (bin) button under each card goes away. The collection name and "8 of 12 in your library" text stay.
- Press and hold OK on a card (or hold the mouse/finger) to open "Remove this franchise?" with Remove and Cancel. Nothing is removed unless you pick Remove. Back works the same as Cancel.
- A short press still opens the collection.
- With the remote, Up, Down, Left and Right move from card to card across the grid. You can no longer land on anything except the cards.

## Technical details
- `src/components/saved-franchise-browser.tsx`: remove the Trash button. Drop the per-card `data-remote-row` so the grid acts as one 2D focus zone. Add `useLongPress` on the poster button, which sets a `removing` state. Reuse the confirm dialog pattern: extend `RemoveConfirmDialog` with a `"franchise"` mode ("Remove this franchise?").
- The grid gets an explicit arrow-key handler that moves focus by index (±1 for Left/Right, ±columns for Up/Down, with the column count read from the grid's computed `grid-template-columns`). Up from the first row goes to the Home/Back button. This means navigation doesn't depend on spatial guessing.
- After a removal, focus moves to the nearest remaining card.
