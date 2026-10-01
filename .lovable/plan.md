# System categories with an always-visible player

## Goal
Make Movies and Shows use the genres saved by Stream Deck instead of the playlist provider’s category names, while keeping browsing and playback together on one screen.

## Screen layout
```text
Movies / Shows
┌────────────────────┬──────────────────────────────────────┐
│ System categories  │ Player                              │
│ Action             │ “Choose a movie / episode”          │
│ Comedy             ├──────────────────────────────────────┤
│ Drama              │ Popular now                         │
│ ...                │ Movie/show tiles for selected genre │
└────────────────────┴──────────────────────────────────────┘
```

- Show system-generated genres as a scrollable, top-down list on the left.
- Keep the player visible at the upper-right from the moment Movies or Shows opens.
- Before a title is chosen, show an empty player state with artwork and a clear prompt.
- Keep Popular now and the title tiles under the player.
- Selecting a genre refreshes the tiles in place without hiding the category list or changing pages.
- On narrow screens, place the player first, then the category list and tiles without horizontal overflow.

## Movies
- Selecting a movie tile loads and starts that movie in the visible player.
- Keep resume tracking, favourites, external-player handoff, and the external-player history badge.
- Update the selected title and details near the player without leaving the browsing screen.

## Shows
- Selecting a show tile loads its seasons and episodes below the player on the same screen.
- Selecting an episode starts it in the visible player.
- Back moves through episode → show tiles → main TV menu, with remote focus restored to the previous selection.

## System category data
- Build the category list from the saved per-title genres in Stream Deck’s shared metadata cache, not Xtream/M3U category labels.
- Match playlist titles to their saved metadata and group titles by their primary system genre.
- Put titles without a saved genre into “Other” so nothing disappears.
- Reuse cached metadata for every account; only resolve missing metadata through the existing organiser flow.
- Keep provider categories available internally for fetching catalogue items, but do not display their names in Movies or Shows.

## Scope and preservation
- Apply the same behavior to regular, phone, and TV/Firestick Movies and Shows screens.
- Preserve Popular now, search, progress, favourites, season/episode navigation, automatic external-player launch, and direct movie/show links.
- Do not change Live TV categories, playlist providers, subscriptions, or account rules.

## Technical approach
- Add an authenticated catalogue-metadata read that returns cached system genres for the current playlist’s titles.
- Consolidate Movies and Shows around a shared browse-and-play workspace rather than navigating to separate watch pages for normal selection.
- Keep existing detail/watch addresses working for bookmarks and history, while routing in-app tile selection into the combined workspace.
- Use category selection as query state so tiles refetch/regroup immediately and Back behavior remains predictable.
- Extend TV focus handling for the persistent category → title → season/episode hierarchy.

## Verification
- Test Movies and Shows with a real signed-in playlist on desktop, phone, and TV dimensions.
- Confirm only system genre names appear, genre changes refresh tiles, and uncategorized titles remain under Other.
- Confirm the empty player is visible before selection, movies play inline, shows reveal episodes inline, and remote Back restores focus.
- Confirm progress, Popular now, favourites, and external-player tracking still work.
