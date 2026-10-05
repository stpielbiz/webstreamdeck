# Unified Live TV guide

## Goal
Replace the separate Live TV and Guide experiences with one TiviMate-style Live TV screen that is fast and predictable with a Fire TV remote.

## User experience
- Remove **Guide** from the section menu so **Live TV** is the single entry point.
- Keep channel categories permanently visible in a scrollable left column, with **All channels** first.
- Show a programme guide in the right workspace: channel rows vertically and a time grid covering the next three hours horizontally.
- Up/Down moves through categories or channels; Left/Right moves between the category column and programme grid, then across later programme times.
- Merely focusing a category updates the guide immediately, matching the home-page focus-follow behavior; OK on a programme/channel starts that channel.
- Keep the focused channel and programme visibly highlighted, keep the current-time position clear, and automatically scroll both axes to keep focus on screen.
- Back first returns from the programme grid to categories, then returns to TV Home.
- When a provider has no guide data, retain the channel row and show a clear “No programme information” span rather than making the channel inaccessible.

## Implementation
1. Refactor the TV Live route into a persistent 20/80 category-and-guide workspace using the existing TV zone and focus conventions.
2. Add a batched schedule query for the visible channel window so the guide can render real programme widths and times without making an unrestricted request for every channel.
3. Build a synchronized three-hour timeline with fixed channel labels, time headers, current-time marker, vertical channel scrolling, and horizontal time scrolling.
4. Preserve device-side playback: selecting a guide cell resolves the channel and opens the existing native/player flow without preloading streams during focus movement.
5. Remove Guide from shared section navigation and TV Home previews. Redirect existing `/tv/guide` links to `/tv/live`; also consolidate the browser `/guide` entry with `/live` so saved links continue working.
6. Keep loading, empty-playlist, empty-category, missing-EPG, and provider-error states navigable by remote.
7. Verify D-pad movement, focus-follow category changes, horizontal time travel, OK playback, and two-step Back behavior at Fire TV dimensions; then check the current build diagnostics.

## Technical notes
- Reuse `getCategories`, `getItems`, `Programme`, `TvShell`, and the existing device playback bridge.
- The current guide only fetches Now/Next in batches, while full schedules are fetched one channel at a time. The new batched server function will enforce channel and time-window limits and bounded concurrency.
- M3U sources currently provide no schedule data in this app; their channels will remain playable with empty guide cells.
- The existing remote-navigation engine will remain authoritative, with explicit zone ordering and preferred zone-entry targets for deterministic Left/Right movement.
