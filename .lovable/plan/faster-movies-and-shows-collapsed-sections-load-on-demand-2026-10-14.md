# Faster Movies and Shows: collapsed sections, load on demand

## Why it feels slow today
- Each category you pass with Up/Down immediately rebuilds the whole content area (re-sorting and drawing up to ~500 posters), even if you are only passing through.
- Every year or letter section draws its posters right away.

## What will change

1. **Category list stays instant.** Moving Up/Down only highlights the category and updates a small header ("Action · 1,240 titles"). Content is built only after you rest on a category for about half a second, or straight away when you press OK / Right.
2. **Sections start collapsed.** Each year or letter is a single row: "2026 · 84 titles". Nothing is drawn inside until opened.
   - **Newest order:** the current year is open; all other years are closed.
   - **A–Z order:** all letters are closed.
   - Press OK on a section to open or close it. Only that section's posters load (still up to 180 at a time, with "Show more").
3. **Remembered for the session.** Sections you open stay open when you come back to that category in the same session (per Movies/Shows, category and order). Closing the app resets it.
4. **Search stays flat.** Search results show as one list (up to 500, with "Show more"), since they are already small and specific.
5. **Remote flow.** From an open section, Down moves through its posters, then to the next section heading. Left goes back to the category list. Back from inside a section returns to its heading first.

## Better ideas included
- The short delay before showing content (point 1) is the biggest speed gain. It works together with the collapsed sections.
- Section headings show the count, so you can see the size before opening one.

## Technical details
- File: `src/components/catalog-workspace.tsx` (plus a small header component in place).
- Category `onFocus` sets a `pendingGenre`; a 450 ms debounced timer commits `genre`; OK/Click/ArrowRight commits immediately. Sorting and sectioning stay in `useMemo`, but they only run on the committed genre.
- New `expanded` state held in a module-level `Map<string, Set<string>>` keyed `${kind}:${genre}:${sort}` (session memory, survives route changes, not persisted). Default: year mode = `{currentYear}`, A–Z = empty.
- Collapsed section = one `data-tv-focus` heading button with `aria-expanded`; expanded renders `PosterGrid` with existing per-section `limits`. Windowing across sections is replaced by the collapse model; search keeps the existing 500 window.
- No changes to data loading, caching, metadata or the browser layout beyond the same collapse behaviour.

## Verification
- Fire TV size preview: hold Down through categories (no grid rebuild until resting), confirm the current year is open, other years and all letters are closed, opening and closing work, and opened sections are remembered after switching category and back.
