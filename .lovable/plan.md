# Confirm before removing from favourites

Press-and-hold on a favourite or a continue-watching title currently removes it instantly (channels) or does nothing (movies/shows). This change makes long-press open a small confirmation window first: "Remove {title} from favourites?" with Remove and Cancel choices. Nothing is removed unless the user picks Remove.

## What changes

1. **Shared confirmation window** — a small dialog (reusing the existing dialog/focus patterns, with `data-dialog-back` so the remote Back key closes it) showing the title and two buttons: **Remove** and **Cancel**. Remove is focused first on TV so one more OK press confirms; Back or Cancel does nothing.

2. **Favourites lists (Home and Favourites, web + TV)** — `src/components/favourites-lists.tsx`:
   - Long-press now works on **all** favourites, not just channels: channels, movies, and shows all open the confirmation window.
   - The instant removal on long-press is replaced by the confirmation; the existing star remove button stays as is.

3. **Continue watching (TV home shelf + web dashboard shelf)** — `src/routes/_authenticated/tv.index.tsx` (`HomeTile`) and `src/routes/_authenticated/dashboard.tsx` (`Shelf`/`PosterTile`):
   - Long-press on a movie/show/episode tile opens the same confirmation window.
   - If the title is in favourites, Remove takes it out of favourites.
   - If it is not a favourite, the window instead offers **Remove from continue watching**, which clears the saved position for that title.

4. **Guide channels stay unchanged** — the press-and-hold add/remove toggle in the Live TV guide keeps its current instant behaviour (it adds as well as removes, so a confirm step there would slow adding down). Only the favourites lists and continue-watching shelves get the confirmation.

## Technical notes

- Reuse `useLongPress` (`src/lib/use-long-press.ts`) as-is; only the callback changes from "toggle now" to "open dialog".
- Removal uses the existing `useToggleFavorite` mutation; clearing continue-watching uses the existing watch-progress store.
- Dialog follows the shared TV focus rules: focus isolated inside the dialog, Back closes it, focus returns to the row that opened it.
- Web change only — takes effect on publish, no new APK needed.
