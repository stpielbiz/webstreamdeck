# Library status: show 100% after a full update, remove Live TV stats

## What changes for the user
- Movies and Shows status on the TV home menu shows **100%** once every title has been checked, even when some titles had no information available.
- The line under the bar reads e.g. "Checked 14,200 of 14,200 · 13,350 matched · 850 no information found", so it stays honest about what was found.
- The Live TV section no longer shows the saved library / TV guide percentage block — just the section description and Open button.

## How
1. Confirm how titles with no match are recorded today (whether the details update saves a "nothing found" result or leaves no trace). If it leaves no trace, save a "checked, nothing found" marker so it is not looked up again and counts as done.
2. Change the percentage to "checked titles / total" instead of "matched titles / total"; keep matched count, description and actor counts in the detail lines.
3. Remove the Live TV status block from the TV home details panel (and drop the unused guide coverage calculation).

## Technical details
- `src/lib/library-sync.tsx` `useLibraryOverview`: add `checked` and `missing` to `LibrarySectionStatus`; `percent = checked / total`; remove the `live` coverage computation (return an empty section).
- `src/lib/metadata.server.ts` / `metadata.functions.ts`: ensure misses are stored (row with null `resolved_title`) and returned to the client as "checked, no data" so the client can count them.
- `src/routes/_authenticated/tv.index.tsx`: stop rendering `LibraryStatus` for Live TV; update movie/show wording.
