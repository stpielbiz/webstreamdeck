# Denser Netflix-style TV home

## Goal
Rework the right side of the Fire TV home so each shelf shows substantially more content without changing the existing left navigation or the underlying library behavior.

## Selected direction
- Keep the Stream Deck charcoal, gold, and cyan palette.
- Use Sora for headings and Manrope for supporting text.
- Follow the selected Netflix-style shelf composition: compact horizontal rows, clear row titles, restrained focus enlargement, and minimal empty space.

## Changes
1. Replace the current shared oversized poster grid on TV Home with purpose-built horizontal shelves that scroll left and right by remote.
2. Make **Continue watching** a compact landscape row with progress bars, title, and remaining-time or episode metadata; display up to 20 saved items instead of 10.
3. Make **Favourite channels** a dense logo row with small square/landscape tiles so many channels fit across the screen; display up to 20.
4. Make **Favourite movies and shows** a compact portrait row with smaller covers and titles; display up to 20.
5. Tighten the welcome area and vertical gaps so all three shelf headings are discoverable within the home workspace while preserving vertical scrolling for smaller screens.
6. Keep the left menu at the existing 20/80 split and preserve focus-follow previews for non-Home menu items.
7. Add deterministic shelf focus behavior: Left/Right stays within a row, Up/Down moves to the nearest item in the adjacent shelf, Left from the first item returns to the menu, and focused items remain visible without resizing the layout.
8. Update the global typography tokens to the chosen Sora/Manrope pairing and load those fonts through the app head.
9. Verify the TV home at 1280×720 with real saved items, including remote entry from the menu, horizontal shelf navigation, vertical shelf changes, scrolling, and Back to the menu.

## Scope
Only the TV Home presentation and its remote navigation density will change. Movies, Shows, Live TV, playback behavior, favourites, and watch-progress data remain unchanged.
