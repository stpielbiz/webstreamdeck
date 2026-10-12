# Favourites list updates instantly

## Problem
When a channel, movie or show is added to favourites (hold OK in the guide, star button, or the details window), the change is saved but the favourites lists don't show it right away — the user has to leave and come back, or waits for a slow refresh. On Fire TV the refresh after saving can be slow or not happen until the page is reopened.

## Fix
Make the favourites list update **instantly, before the server reply**:

1. **Instant update in the shared favourites hook** (`src/lib/library-hooks.ts`, `useToggleFavorite`):
   - The moment the user toggles a favourite, the cached favourites list is updated on the spot (the row is added or removed immediately), so the star fills and every favourites list (Home, Favourites page, TV home) shows the change at once.
   - If the save fails, the change is undone and an error message is shown instead of the success toast.
   - When the save finishes, the list is refreshed from the server in the background to stay in sync.

2. **Success message only on success** — the "Added to favourites" / "Removed from favourites" messages already appear only after a successful save; with the instant update the visible list and the message will always agree.

3. **No behaviour changes elsewhere** — the guide's hold-to-favourite, the confirmation window before removing from favourites/continue watching, and cross-playlist sync all keep working as they do now.

## Technical notes
- Use the mutation's `onMutate` to optimistically update the `["favorites"]` query cache (add a temporary row or remove the matching row), `onError` to roll back, and `onSettled` to invalidate `["favorites"]` so a background refetch reconciles.
- The temporary row needs a generated id; it is replaced by the real row on refetch.
- Web change only — takes effect on publish, no new APK needed.
