# TV menu library status

## Goal
Replace the generic right-side summaries for **Live TV**, **Movies**, and **Shows** with useful, remote-friendly library status. Keep the existing open-section button and add top genres for Movies and Shows.

## What will change
- Add a shared on-device status model for the active playlist, derived from the library already saved on the Fire TV.
- **Live TV** will show:
  - total saved channels
  - TV-guide coverage as a count and percentage
  - a progress bar while guide data is updating
  - the last successful channel/guide update time
- **Movies** and **Shows** will each show:
  - total saved titles and local sync state
  - enriched title coverage, such as “Updated 10,333 of 17,003 shows”
  - an enrichment progress bar and percentage
  - the three most common known genres
  - the last successful catalogue/details update time
- Use clear waiting/empty/error wording when a playlist has not loaded yet, without showing misleading percentages.
- Preserve the current Fire TV navigation: menu focus stays on the left; Right moves to the existing action button; the status display itself is not focusable.

## Technical details
- Read channel, movie, show, guide, and metadata totals from the existing query cache and persisted on-device library rather than creating a second library store.
- Make background title enrichment expose a reliable per-kind completed count and keep its canonical metadata summary updated, so the home screen changes as enrichment proceeds.
- Calculate top genres only from titles with saved metadata; do not imply that incomplete metadata represents the whole library.
- Use the existing semantic colours, borders, and button components; add compact progress rows rather than nested cards.
- Keep this device-local: no new database table or account-wide analytics are required.

## Verification
- Check Live TV, Movies, and Shows with a populated playlist and confirm counts match the saved catalogues.
- Confirm guide and title-detail percentages advance while background work runs and remain correct after restarting the app.
- Verify remote Left/Right/Up/Down/OK/Back behaviour is unchanged and no new status text receives focus.
- Check empty-playlist and partially synced states, plus the Fire TV-sized layout for clipping or overlap.
