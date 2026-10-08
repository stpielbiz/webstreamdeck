# Compact featured row for Movies and Shows

## Goal
Keep Popular here and Top 10 useful without letting them hide the selected category’s movies or shows below.

## Changes
1. **Shorter featured row** — reduce the Popular and Top 10 poster cards on TV, tighten the heading and spacing, and keep the row horizontally scrollable.
2. **Selected category stays visible** — when Adventure or another category receives focus, automatically position the right panel so that category’s heading and first row of titles are visible beneath the compact featured row.
3. **Easy return to featured content** — Popular here, Top 10 Netflix, and Top 10 Prime will still move the right panel back to the top and focus their first title.
4. **Movies and Shows together** — apply the same sizing and focus behavior to both screens.
5. **Verification** — check TV-sized Movies and Shows views to confirm the selected category’s first titles remain visible, with no overlap or broken remote navigation.

## Technical details
- Adjust the TV-only card widths, typography, margins, and poster height in the shared Popular and Top 10 row components; browser sizing remains unchanged.
- Add an anchor for the category-content section and scroll it into view when the focused category changes.
- Preserve the existing 20/80 layout, featured-row swapping, local caching, and focus zones.
