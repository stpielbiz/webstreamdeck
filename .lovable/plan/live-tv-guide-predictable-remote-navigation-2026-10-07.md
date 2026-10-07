# Live TV guide: predictable remote navigation

## What the user will get
- From a category (e.g. USA Sports), **Right** lands on the **first channel, current programme**.
- **Down / Up** moves to the next / previous channel and stays at the **same time** (current time if you haven't moved right). Never jumps sideways.
- **Right** moves to later programmes on that channel; **Left** moves back toward the current programme.
- **Left** on the current programme returns focus to the selected category (USA Sports).
- **Back** from anywhere in the guide (any channel, any time) jumps straight to the selected category and scrolls the guide back to now. If a channel is full screen, Back first exits full screen (unchanged); if the small preview is playing, Back stops it and jumps to the category in the same press.

## Technical details
- Cause: the guide relies on generic geometry-based focus, so Down picks whichever wide programme cell is nearest on screen (often a future one), and the Back handler only returns to categories when the focus zone check matches.
- In `tv.live.tsx`, add an explicit `onKeyDown` handler on the guide container (`live-guide`) that handles Arrow keys itself (preventDefault + stopPropagation so the spatial nav doesn't also move):
  - Each programme cell gets `data-row={rowIndex}` and `data-col={programmeIndex}` plus its start time.
  - Up/Down: find the target row's cell whose time range contains the focused cell's start time (fallback: first cell); for Up from row 0 → search box; Down past last row → "Next channels" button.
  - Left on col 0 → focus `live-category-<categoryId|all>`; Left/Right otherwise → previous/next cell in the row, then `revealCell`.
- Category buttons: Right/Enter focuses the first channel's first cell (`data-zone-entry`).
- Back handler: after full screen check, always stop any preview, scroll the guide to 0, and focus the selected category when focus is in the guide or the preview; otherwise keep existing behaviour (categories → TV Home).
- No changes to the native app; web update only.
