# TiviMate-style three-layer navigation

## Goal
Make Live TV, Movies, and Shows predictable with a remote, mouse, keyboard, or touch. The experience will use three clear layers and never allow focus to jump into unrelated page controls.

```text
1. Sections        2. Categories        3. Content
   Guide               Sports              Channels
   Live TV              Drama               Movies
   Movies               Comedy              Shows
   Shows                 News                Episodes
```

## Layer behavior
- Replace the current top navigation and category tile screens with one shared, three-layer browsing pattern.
- **Layer 1 — Sections:** a vertical list for Guide, Live TV, Movies, Shows, Favourites, and Home.
- Choosing a section slides Layer 1 away and opens **Layer 2 — Categories** as a top-to-bottom list.
- Choosing a category slides Layer 2 away and opens **Layer 3 — Content** with channels or title tiles.
- Back reverses exactly one step, restores the previous column with a short slide animation, and returns focus to the item that opened the next layer.
- Left from the first item boundary behaves like Back; Right/OK advances only when an item can open the next layer.
- Use the same hierarchy on TV, desktop, tablet, and phone, with widths adapting to the available screen rather than changing the interaction model.
- Respect reduced-motion settings by removing the slide animation while preserving the same focus behavior.

## Player and information area
- Keep a compact 16:9 preview at the top of the content layer instead of a large player dominating the page.
- Show the selected channel/title artwork, name, programme or plot information, and resume status beside or directly below the preview.
- Keep the channel list, movie tiles, show tiles, seasons, and episodes beneath the preview.
- Selecting a channel, movie, or episode updates the preview and information without navigating away from the workspace.
- Full Screen expands only when explicitly selected; VLC/native-player actions keep their existing device handoff and open full screen externally.
- Keep player controls out of remote focus while hidden so navigation cannot accidentally enter invisible controls.

## Deterministic remote navigation
- Replace the current page-wide “nearest item” focus calculation with named focus zones for sections, categories, content, player actions, seasons, and episodes.
- Limit directional movement to the active layer; crossing layers happens only through the defined Left/Right/OK/Back rules.
- Store focus independently for every layer and restore the exact section, category, title, channel, season, or episode when returning.
- Move focus to the first valid item when a new layer opens, and keep focused rows or tiles scrolled into view.
- Prevent focus from escaping into the Lovable badge, browser chrome, hidden player controls, or unrelated controls.
- Make Firestick Back, Escape/Backspace, visible Back controls, mouse clicks, and touch navigation follow the same hierarchy.

## Screen-specific content
- **Live TV:** system section → provider channel-category list → channel guide/list; preview and Now/Next information remain above the channels.
- **Movies:** system section → saved system-category list → smaller movie tiles; selecting a movie opens it in the compact preview.
- **Shows:** system section → saved system-category list → smaller show tiles; selecting a show replaces the tiles with seasons and episodes below the preview.
- **Guide:** remains available as a first-layer section and uses the same focus-zone rules.
- Preserve Popular Now, favourites, search, watch progress, external-player tracking, smart system categories, and playlist switching.

## Implementation approach
- Build a shared layered-navigation controller and reusable section/category column components rather than maintaining separate Back and focus rules per page.
- Update the shared TV shell and regular app shell so both use the same section model while retaining their appropriate visual density.
- Refactor the shared Movies/Shows workspace and Live TV screens into the layered layout.
- Update the spatial-navigation hook to understand zones, boundaries, active-layer eligibility, and focus restoration.
- Update the video player so only visible player actions participate in remote navigation.
- Keep existing URLs working; this is a presentation and navigation redesign, not a change to playlists, accounts, subscriptions, providers, or stored catalogue data.

## Verification
- Test complete three-layer flows for Live TV, Movies, Shows, Guide, seasons, and episodes with Firestick-style arrow/OK/Back input.
- Confirm every Back step restores both the previous column and its prior focus.
- Confirm long category/channel/title lists scroll without focus escaping.
- Confirm hidden controls and the Lovable badge are never selected by D-pad navigation.
- Confirm compact preview, Full Screen, VLC/native playback, resume tracking, and external-player history still work.
- Check TV, desktop, tablet, and phone layouts, including reduced-motion mode.
