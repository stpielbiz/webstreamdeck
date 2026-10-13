# Top 10 rows: wait for the library before saying "Not in your list"

## Problem
In Movies and Shows, the "Top 10 on Netflix / Prime Video" rows check each title against the user's catalogue. While the catalogue is still downloading (from the device cache or the provider), the row gets an empty list, so every tile immediately shows "Not in your list" — even though many titles will match once the download finishes.

## Changes

### 1. `src/components/top10-rows.tsx`
- `Top10Row` accepts a new `loading` prop.
- While `loading` is true (or the Top 10 list itself is still downloading), each tile shows an animated placeholder instead of a verdict: a pulsing poster box with the rank badge and a shimmering "Checking your list…" label — no "Not in your list" until loading is finished.
- "Not in your list" only appears once both the catalogue and the Top 10 data have finished loading and the title genuinely has no match.

### 2. `src/components/catalog-workspace.tsx`
- Pass `loading={catalogue.isLoading && !catalogue.data}` into both `Top10Row` usages so the row knows when the catalogue is still being fetched.

## Technical details
- No backend or data changes; purely presentational.
- Animation uses existing Tailwind `animate-pulse` on skeleton blocks, consistent with the catalogue's other loading placeholders.
- Works on web and Fire TV (same component serves both).

## Verification
- Build check via `/tmp/observability/build-errors.log`.
- Preview: open Movies with a cleared cache and confirm the Top 10 row shows the animated checking state first, then resolves to real tiles / "Not in your list" only where appropriate.
