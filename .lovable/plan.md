# Saved franchise lists and easier TV search

## Goal

Make franchise collections something users deliberately save and revisit, repair the Fire TV Search action, and put Movies/Shows search and sorting at the start of the remote flow.

## User experience

### Save a franchise from title details
- Add an **Add to Franchise lists** action inside the existing related-franchise section of every movie/show popup.
- Explain beside the action that the collection will appear in the **Franchise** menu.
- Change the action to **Remove from Franchise lists** after saving, with immediate success feedback.
- Save lists to the signed-in account so they are available on the user's other devices and playlists.
- Avoid duplicates when another title belongs to an already-saved collection.

### Franchise menu
- Add a **Franchise** item to the main browser and Fire TV menus only when the user has saved at least one collection.
- Add browser and TV Franchise pages showing the saved collections, title coverage, release/story ordering, and the existing movie/show details popup when a title is selected.
- Allow a saved collection to be removed from the Franchise page as well as from the title popup.
- Keep unavailable entries visible as **Not in your list**, consistent with the current franchise display.

### Repair the Fire TV Search action
- Replace the failing Android speech-recognition launch—the source of the current “Voice search isn't available” message—with an app search event.
- On Home, that action focuses the global search field; inside Movies or Shows, it focuses that module's search field.
- Focus the text field in a way that opens the Fire TV keyboard when supported, while preserving normal remote Back behavior.
- Remove the separate **Speak** controls and voice-only fallback so users no longer reach an unavailable action.

### Movies and Shows controls
- Move a compact control row to the top of the Movies/Shows content area, before Popular/Top 10 and the title shelves.
- Make the remote sequence deterministic: **Right from the category rail → Search → Right → Sort**.
- Use one Sort control that clearly shows the active order and switches between **Newest** and **A–Z** without adding another difficult focus target.
- Keep Down from the controls entering the currently displayed title content and preserve the existing category and featured-row behavior.

## Technical details

- Add an authenticated, owner-scoped saved-franchise table with explicit grants and row-level access rules; apply it through the database migration tool.
- Add focused hooks/actions for listing, saving, and removing franchise collections, then invalidate the relevant account cache after changes.
- Add dedicated `/franchises` and `/tv/franchises` routes with unique page metadata and TV-mode return behavior.
- Extend the shared section menu and TV Home preview conditionally from the saved-list count; no Franchise entry renders for an empty account.
- Add a web event/focus utility shared by Home and catalogue screens, and update the Android bridge/key handler to emit it instead of starting device speech recognition.
- Record the saved-franchise navigation rule in the project architecture notes.

## Verification

- Save and remove a franchise from movie and show popups; confirm the menu appears for the first saved list and disappears after the last removal.
- Open saved collections on browser and TV pages, switch order, open an owned title, and return with Back.
- Test the Fire TV Search key on Home, Movies, Shows, and another TV page; confirm it reaches a working text search without the unavailable message.
- Verify remote focus order Category → Search → Sort → content on Movies and Shows at Fire TV dimensions.
- Check the authenticated saved-list access rules, relevant tests, preview errors, and the final build signal.