# TiviMate-style browsing and player layout

## Goal
Make Live TV, Movies, and Shows easier to use with a Firestick remote while applying the same clear structure on computers and phones.

## User flow
```text
Main menu
  → Live TV / Movies / Shows
    → Category list
      → Channels / movie titles / show titles
        → Player in the upper-right
```

- Opening Live TV, Movies, or Shows first displays a full, scrollable category list rather than category buttons or a dropdown.
- Choosing a category replaces that list with its content; the previous level is no longer visible.
- Choosing a live channel or movie starts it in the upper-right player immediately.
- Choosing a show opens its season and episode list; choosing an episode starts it in the upper-right player.
- Back returns one level at a time: player/content → category list → main menu.
- The visible Back control and the Firestick remote Back button will follow the same hierarchy.

## Layout changes
- Standardize the playback workspace across Live TV, Movies, and Shows: browsing/list content on the left and the video player fixed at the upper-right on wide screens.
- On narrow phone screens, keep the player first at the top, followed by the active list, so nothing is pushed below unreachable content.
- Keep the active title, programme information, seasons, and episodes near the player without moving it lower on the page.
- Replace the current oversized poster grid with smaller, denser tiles and tighter gaps, while preserving readable names, artwork, progress, favourites, and external-player status.
- Keep strong, visible focus states and ensure focused rows/tiles scroll into view.

## Firestick navigation
- Add explicit browsing levels instead of relying on browser history or a single “Back to TV Home” action.
- Restore focus to the previously chosen category or title when returning to a prior level.
- Make every category, title, channel, season, episode, and player action reachable with directional keys and OK.
- Remove hidden category limits so the full category list can be reached and scrolled.

## Scope
- Update both the dedicated TV interface and the regular Live TV, Movies, and Shows screens.
- Preserve playlist loading, favourites, guide data, resume tracking, external-player handoff, and automatic VLC launch behavior.
- Do not change streaming providers, account rules, subscriptions, or stored catalogue data.

## Technical approach
- Extend the shared TV shell/navigation hook to accept page-specific Back behavior and focus restoration.
- Introduce reusable category-list and playback-workspace patterns so the TV and regular screens behave consistently.
- Rework the existing Live TV, movie, and series browsing/detail views around explicit `menu → category → content/player` state.
- Adjust the shared tile/grid sizing once so Home, Favourites, Movies, and Shows remain visually consistent.
- Verify the complete flow with keyboard/remote controls at TV, desktop, and phone sizes, including long category and channel lists.
