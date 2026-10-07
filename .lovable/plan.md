# Rename "Popular now" to "Popular on Stream Deck"

The row is built from what everyone using Stream Deck watched in the last 7 days, so it is genuinely platform popularity — unlike the "Top 10 Netflix" and "Top 10 Prime" rows beside it. The new name says that plainly.

## What changes

**1. Row heading (above the tiles, on Movies and Shows)**
- "Popular now" becomes **Popular on Stream Deck**.
- Appears on both the TV screens and the normal browser screens, since both use the same component.

**2. Button in the left category list**
- "Popular now" becomes **Popular here** — short enough that nothing gets cut off in the narrow column.
- It still jumps to the top of the page and lands you on the first tile of the row, exactly as it does today.

**3. Nothing else moves**
- The row's position (directly above the Netflix and Prime rows), its tiles, the #1–#10 rank numbers, and the "not in your playlist" behaviour are all unchanged.
- Remote navigation is untouched: Up/Down still reaches the row, OK still opens the title from your own playlist.

## Technical details

- `src/components/popular-row.tsx`: heading text in the `<h2>` (line ~60) changed to "Popular on Stream Deck"; the doc comment above the component updated to match.
- `src/components/catalog-workspace.tsx`: the category-rail button label (line ~282) changed to "Popular here". Its `data-focus-key="category-popular"`, `Flame` icon, and `goToPopular` click handler stay exactly as they are, so `popular-0` focus targeting and the spatial-navigation order are unaffected.
- No database, function, or native-app change — the `popular_titles` source and the Fire TV app are untouched. This is a website change, so the Fire TV app picks it up on its own without a rebuild.
- Verified by a text search that these two labels are the only places the old wording appears; the `popular-0` / `category-popular` identifiers are internal focus keys, not visible text.
