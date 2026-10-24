# "Run a full update" reminder on the Home screen

## What you'll see
A card at the top of Home (website and Fire Stick TV home):
```text
Get a faster Streamivo
Run a full update to save your channels, movies, shows and their details
on this device. Browsing then loads from your device and feels faster.
Last full update: 9 days ago
[ Update everything ]   [ Later ]
```
- **When it appears:**
  - on a device that has never run a full update (for example a new Fire Stick or a newly added playlist), or
  - when the last full update on this device was **more than 7 days ago**.
- **Later:** hides the card for **3 days**, then it comes back if the update still hasn't run.
- **Update everything:** updates channels, then movies, then shows, then fills in movie and show details. The card stays put with progress like "Movies 2,400 / 9,000" and a **Stop** button. When it finishes it says "All set — everything is saved on this device" and closes.
- It runs in the background, so you can keep browsing. It pauses while a video plays, the same way updates already do.
- Each device and playlist keeps its own date, because the data is saved on that device.
- Accounts with no playlist don't see the card.

## Timing
- 7 days: channel lists and new movies change often enough that once a week keeps things fresh, without nagging.
- 3 days after **Later**.
- Both are single settings in one place, so they're easy to change.

## Technical details
- New `src/lib/full-update.ts`: `lastFullUpdate(playlistId)` and `snoozeUntil` kept in localStorage (`streamdeck.fullUpdate.<playlistId>`), plus `FULL_UPDATE_DAYS = 7` and `SNOOZE_DAYS = 3`; `needsFullUpdate()` is a pure function, with a small test.
- `runFullUpdate`: `requestLibraryRefresh(id)` and wait for `useLibraryRefreshStatus` to finish, then `runBulkRefresh` for movies and then for series, with the same `refreshTitles` call Settings uses. It records the date only when every step completes; Stop leaves the date unchanged.
- New `src/components/full-update-card.tsx`, shown on `dashboard.tsx` and `tv.index.tsx` above the content. It follows the remote focus rules, and the remote doesn't jump to it on load (Home menu focus stays first).
- Website change only; no app update.
