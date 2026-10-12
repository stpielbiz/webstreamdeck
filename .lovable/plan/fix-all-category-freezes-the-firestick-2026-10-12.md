# Fix: "All" category freezes the Firestick

## Problem

In Movies and Shows, the **All** category (and search results) splits every title into letter or year sections and renders up to 180 poster tiles per section at the same time. With 14,000+ movies that means thousands of tiles on screen at once — the Firestick becomes almost unresponsive. The category counts stay correct; only the on-screen rendering is the problem.

## Fix

Render the list in windows instead of all at once:

1. **Cap the first render at 500 tiles total.** In `catalog-workspace.tsx`, the section list renders only enough sections to reach 500 tiles (whole sections, so a letter is never cut in half).
2. **"Show more" at the end.** A tile after the last rendered section shows how many titles are left; pressing it loads the next 500. When you reach the end of what is on screen and press Down/Right, the next batch loads automatically and focus moves to the first new tile — so scrolling with the remote just works.
3. **The count stays honest.** The heading still shows the real total (e.g. "All · 14,203"), and the category list count is unchanged.
4. **Applies to All and search results.** Single system categories (Action, Comedy…) keep the current behaviour, since they are much smaller — but they get the same 500-tile window if they ever grow past it.
5. **Lighter tiles while scrolling.** Poster images already load lazily; tiles beyond the window are never created, so the Firestick only ever keeps a few hundred tiles in memory.

## Technical details

- File: `src/components/catalog-workspace.tsx` only.
- New state: `visibleCount` (default 500, +500 per "Show more"), reset when category, search, sort or playlist changes (alongside the existing `setLimits({})` reset).
- The rendered `sections` array is sliced so the cumulative tile count stays under `visibleCount`; a trailing "Show more · N left" tile renders when items remain.
- Auto-load on remote scroll: the last rendered tile's `onFocus` (or an ArrowDown/ArrowRight handler on it) triggers the same +500 increase, then focuses the first newly added tile via `requestAnimationFrame`.
- No changes to data loading, caching, or the category rail; browser layout unchanged.

## Verification

- Build clean; preview at Fire TV size (1280×720): open Movies → All, confirm ~500 tiles render, the count still shows the full total, "Show more" loads the next batch, and remote-style ArrowDown past the last tile auto-loads more.
