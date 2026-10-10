# Fix franchise matching and malformed search titles

## Goal
Make episode-formatted shows such as `EN - 1923 (2022) - S01-E01 - 1923` match the correct franchise entry, and display clean titles without trailing empty parentheses.

## Changes
- Strengthen the shared title cleanup so episode-formatted provider names are reduced to the real show name while preserving a numeric title such as `1923` and extracting `2022` as its release year.
- Remove empty trailing brackets such as `()` from provider titles and saved resolved titles; when a release year is known, keep showing it in the existing year/subtitle position rather than leaving empty punctuation in the title.
- Use the same cleaned title and year for catalogue grouping, global search, details, and franchise matching so `1923` is recognized as owned instead of greyed out.
- Keep stream variants and all episodes linked to the original provider IDs, so playback behavior does not change.

## Technical details
- Centralize the extra cleanup in the browser-safe title normalization/grouping utilities rather than patching individual screens.
- Handle common episode markers including `S01-E01`, `S01E01`, and equivalent separator variations.
- Sanitize metadata titles before they override provider-title cleanup.
- Add focused automated coverage for numeric series names, language prefixes, episode suffixes, empty parentheses, year extraction, grouping, and franchise matching.

## Verification
- Search for `1923`; confirm one clean show result appears as `1923` with year `2022`, without `()` or episode text in the show title.
- Open the Yellowstone franchise list; confirm `1923` is selectable and no longer marked “Not in your list.”
- Search for Yellowstone and other titles previously shown as `Title ()`; confirm empty parentheses are removed and known years still appear.
- Confirm opening the cleaned result still shows all seasons/episodes and starts the selected provider stream.
