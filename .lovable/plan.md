# Fire TV home: TiviMate-style menu and content

## Goal
Rebuild the TV home screen into a couch-friendly two-pane experience: a compact menu on the left and useful content on the right. Moving Up or Down changes the right-side preview immediately; pressing OK opens the focused section.

## What changes
1. **Persistent left menu**
   - Keep Home, Guide, Live TV, Movies, Shows, Favourites, Playlists, Get the TV app, and Admin in a fixed, independently scrollable left rail.
   - Highlight the focused item clearly and keep it visible when the list scrolls.
   - Moving Up or Down updates the right pane without opening another page.
   - Pressing OK opens the focused section. Right moves into the right pane; Left returns to the menu.

2. **Detailed Home pane**
   - Show Continue Watching first, including progress, episode information, and external-player status.
   - Show Favourite Channels and Favourite Movies/Shows underneath.
   - Use compact horizontal rows so several items remain visible at Fire TV resolution.
   - Keep each row independently reachable and automatically scroll the focused tile into view.

3. **Section previews**
   - While the menu focus is on Guide, Live TV, Movies, Shows, or Favourites, show a lightweight preview of that section in the right pane using already-loaded account data.
   - Do not start streams or load video previews while browsing the menu.
   - Playlists, Get the TV app, and Admin receive simple action previews; Admin remains visible only to the authorized admin account.

4. **Scrolling and remote navigation fix**
   - Put the menu and content into one ordered focus group with explicit left/right transitions.
   - Stop trapping ArrowDown at Admin; only suppress a remote key when focus actually moves.
   - Give all home content rows valid focus zones so every tile below the fold is reachable.
   - Back from the content pane returns to the menu; Back from the menu keeps the existing TV-level behavior.

5. **TV-size layout**
   - Fit the workspace within the available screen height, with separate scrolling for the menu and content.
   - Reduce oversized spacing and tiles at 1280×720-class Fire TV dimensions while preserving the desktop layout.
   - Use the existing colors, typography, focus ring, watch history, favourites, playlist selection, and native playback behavior.

## Technical details
- Refactor the TV home route into a two-column, full-height workspace and add focus-driven section preview state.
- Extend the shared section menu with optional focus callbacks and ordered-zone attributes while preserving link/OK activation.
- Update spatial navigation so failed directional moves do not block natural scrolling, and support deterministic menu-to-content transitions.
- Keep all preview content data-only; no stream request occurs until the user selects a playable tile.

## Verification
- Test at 1280×720 and the current desktop viewport.
- Confirm every menu entry is reachable, including Admin, and the rail scrolls when necessary.
- Confirm Up/Down changes the preview without navigation, OK opens the section, Right enters content, and Left returns to the menu.
- Confirm Continue Watching and all favourite rows are reachable below the first screen.
- Confirm Back behavior, admin visibility, playback launch, and a clean build.