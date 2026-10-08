# Right from "Popular here" / Top 10 goes into that top row

## Problem
When you press Right from any button on the left, focus jumps to the screen's main starting tile. That tile is always the first title in the category list under the top row. So pressing Right from "Popular here", "Top 10 Netflix" or "Top 10 Prime" skips the top row.

## Change
- Right from **Popular here**, **Top 10 Netflix** or **Top 10 Prime** switches the top row to that choice, if it isn't showing already, and focuses its first tile.
- Right from a normal category still goes to the first title of that category.
- Up from the first line of category titles still reaches the top row, and Left from the top row returns to the button you came from.
- Applies to Movies and Shows on TV and in the browser.

## Technical details
- `catalog-workspace.tsx`: wrap the featured row (Popular/Top10) in a container with `data-featured-row`. On the three rail buttons, add `onKeyDown` for `ArrowRight`: `preventDefault` + `stopPropagation`, `setFeatured(...)`, then on `requestAnimationFrame` focus the first `[data-tv-focus]` inside `[data-featured-row]` (retry a few frames while Top 10 data loads; fall back to the default zone entry if the row is empty).
- Remember the rail button that was used so Left from the first featured tile focuses it again.
