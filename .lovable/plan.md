# Movies and Shows: Fire TV 20/80 browsing layout

## Goal
Make Movies and Shows match the useful desktop density on Fire TV and other landscape screens: categories remain visible in a narrow left pane while the selected category's preview and titles remain visible on the right.

## User flow
1. From Sections, choose **Movies** or **Shows**.
2. Open one browsing screen with two persistent panes:
   - **Categories — 20%:** vertical list of saved system categories and title counts.
   - **Browse — 80%:** compact preview and information at the top, followed by the selected category title, search, and smaller title tiles.
3. Focus the first category on entry and show that category's titles immediately; do not present a separate category-only screen.
4. Selecting or focusing a category marks it active and refreshes the right pane without hiding either pane.
5. Selecting a movie loads it into the preview. Selecting a show loads its details, seasons, and episodes in the right pane while categories stay visible.
6. Back from anywhere on the Movies or Shows workspace returns directly to Sections and restores focus to Movies or Shows.

## Fire TV display improvements
- Make the workspace fit the available TV browser height rather than growing as one long page.
- Give the category list and title area their own scrolling regions so the header and preview do not push titles below the screen.
- Keep the preview compact and 16:9, with title/plot information beside or immediately around it instead of leaving a large empty area.
- Increase title density at 1280×720-class landscape sizes with smaller poster tiles, tighter gaps, and shorter labels while retaining clear remote focus rings.
- Remove breakpoint behavior that treats lower-resolution Fire TV like a narrow stacked page; the 20/80 layout will remain active on landscape TV/tablet widths.
- Preserve a usable narrow-phone fallback without changing the requested persistent two-pane behavior on PC and Fire TV.

## Remote navigation
- Treat the category pane and browse pane as coordinated focus zones.
- Up/Down stays within the current list or tile grid; Right moves from the active category into titles; Left returns from titles to the active category.
- Prevent focus from escaping into browser controls or the Lovable badge.
- Keep the selected category visible while its titles scroll independently.
- Back always exits Movies/Shows to Sections rather than hiding the category pane.

## Preserve
- System-generated categories, Popular Now, search, favourites, progress, external-player tracking, full-screen/VLC/native playback, automatic next episode, and admin organisation.
- The same shared Movies/Shows workspace for regular web and `/tv` screens.

## Technical implementation
- Refactor the shared catalog workspace from separate `genre === null` and content branches into one persistent split layout.
- Update spatial navigation to support explicit transitions between the category and browse zones while retaining boundary protection.
- Add viewport-height-aware sizing and denser poster-grid breakpoints using the existing design tokens and shared controls.
- Keep playback and data fetching unchanged; category selection only changes the visible item set and resets the selected title when appropriate.

## Verification
- Verify Movies and Shows at 1280×720 Fire TV dimensions and the current 1775×960 desktop dimensions.
- Confirm both panes remain visible, the first category loads automatically, changing categories refreshes titles, remote Left/Right/Up/Down is predictable, Back returns to Sections, and movie/show playback controls still work.
- Check a phone viewport for readable fallback behavior and confirm the project builds without errors.
