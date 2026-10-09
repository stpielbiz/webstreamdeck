# Group duplicate movie and show streams

## Goal
Show one catalogue tile for the same movie or show, while preserving every provider stream as a selectable link inside the existing details window.

## User experience
- Collapse duplicate Movies and Shows entries when their cleaned title and release year identify the same title.
- Keep genuinely different releases separate when their years differ.
- Use the cleaned title, poster, category, cast, and description already available for the grouped tile.
- Add a remote-friendly **Version** selector beneath the description in the details window whenever more than one stream is available.
- Label versions from meaningful provider text, including **4K**, **UHD**, **FHD**, **HD**, **SD**, **HEVC**, language, or similar distinguishing tags.
- When duplicate names provide no meaningful distinction, label them **Link 1**, **Link 2**, and so on.
- Default to the best clearly identified quality in this order: 4K/UHD, FHD, HD, SD, then the first available link. The user can change it before pressing Play.
- For movies, the chosen version controls playback. For shows, choosing a version loads that version's seasons and episodes before playback.
- Keep the selector fully navigable by Fire TV remote, and restore focus correctly after playback or closing the window.

## Catalogue and discovery coverage
- Apply grouping to the Movies and Shows catalogue grids, category counts, sorting, searching, Popular here, and Top 10 matching.
- Apply the same grouped results to home search so duplicate versions do not appear as separate search rows.
- Pass the complete version list into the shared details window, including when opened from the TV or browser catalogue.
- Preserve individual provider IDs internally so playback URLs, episode lists, progress, and provider requests still use the selected real stream.

## Favourites and progress
- Treat a grouped title as favourited when any of its versions is already favourited.
- Adding a grouped favourite saves the currently selected version; opening it later rebuilds the available version list from the saved on-device catalogue when possible.
- Preserve existing favourites and watch history without a data migration.
- Resolve resume progress against the selected version first, then the same cleaned title when applicable, so changing quality does not hide a useful resume point.

## Technical details
- Add a shared, browser-safe title-grouping utility that returns a representative item plus all source variants and deterministic labels.
- Base the group key on the existing cleaned metadata title/year when available, with the current provider-title normalization as fallback.
- Keep raw catalogue data in the device cache; derive grouped views in memory so no stream IDs or provider entries are discarded.
- Extend `TitleDetailsDialog` to accept variants and switch its movie/series detail and playback queries to the selected variant ID.
- Reuse the same grouping/index logic in catalogue, global search, Popular, Top 10, favourites lookup, and playlist-sync matching to prevent inconsistent duplicate handling.

## Verification
- Test duplicate names containing 4K, UHD, FHD, HD, language tags, and indistinguishable names.
- Verify same-title/different-year releases remain separate.
- Verify movie playback, show season loading, version switching, favourites, resume progress, Popular/Top 10 matching, search, and Back/focus behavior.
- Check both desktop and Fire TV layouts, including remote-only navigation through the version selector.
