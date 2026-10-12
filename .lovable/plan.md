# Long-press a channel to favourite it

## Goal
Pressing and holding on a channel (Fire TV remote OK button, or mouse/touch on the web) toggles it in favourites: added if not there, removed if it already is.

## Changes

- New shared hook `src/lib/use-long-press.ts`:
  - Fires after ~600 ms of holding; a quick press still triggers the normal click (play/select).
  - Handles remote OK (held `Enter` keydown repeats), mouse press-and-hold, and touch press-and-hold.
  - Cancels on release, move, or scroll so accidental holds don't favourite.

- Fire TV guide (`src/routes/_authenticated/tv.live.tsx`):
  - Channel name buttons in the guide get the long-press handler: hold OK to add/remove the channel from favourites.
  - Uses the existing `useFavorites` / `useToggleFavorite` hooks; a small star appears on the channel row when it's a favourite.
  - Brief on-screen confirmation (sonner toast: "Added to favourites" / "Removed from favourites") so remote users get feedback.

- Web Live TV (`src/routes/_authenticated/live.tsx`):
  - Channel rows get the same long-press toggle, in addition to the existing hover star button (which stays).

- Favourites lists (`src/components/favourites-lists.tsx`):
  - Channel entries also support long-press to remove from favourites, keeping behaviour consistent.

## Validation
- Build passes.
- Preview: long-press a channel with the mouse — toast appears and the star fills; long-press again removes it.
- Quick click still plays/selects the channel as before.
- Note for the user: Fire TV remote hold uses the same OK key, verified on the web preview; physical Firestick check recommended after publish.
