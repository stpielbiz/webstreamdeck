# "Where's the game?" — suggest channels for a team search

## What you'll see
- In Live TV search (and Home search), typing a team name such as **Montreal Canadiens** adds a **"Game on today"** card above the channel results when that team plays today or tomorrow.
- The card shows the matchup, start time (your local time) and the TV networks broadcasting it (for example Sportsnet, TVA Sports, ESPN+, the opponent's local network).
- Below that: **Suggested channels** — channels from your own playlist whose names match those networks (e.g. "CA: Sportsnet East", "TVA Sports HD", "NHL Center Ice 12"). OK starts the channel full screen, like any channel.
- If no broadcaster matches, it still suggests channels with the team or league in the name (e.g. "NHL", "Canadiens").
- Works even when your provider's guide is empty, because the information comes from the internet, not the provider.
- If nothing is found (no game, unknown team), the card just doesn't appear.

## Scope
- Leagues covered first: NHL, NBA, NFL, MLB, MLS, plus major soccer leagues. Team nicknames and cities both work ("Habs", "Canadiens", "Montreal").
- Website-only change; reaches the Fire Stick on publish, no app update.

## Technical details
- New server function `findGameBroadcasts({ query })`: queries ESPN's public scoreboard endpoints (no key) for today + tomorrow across the supported leagues, matches the query against team names/abbreviations/nicknames, returns `{ matchup, startsAt, league, broadcasts: string[] }`. Cached in memory ~10 min per query; cached in React Query client-side.
- Fallback when ESPN has no broadcasters: Lovable AI (gemini flash) asked to list likely Canadian/US networks for the matchup, labelled "likely".
- On-device matcher `suggestChannels(broadcasts, team, league, channels)` in a browser-safe module: normalises names (strips country prefixes, HD/FHD/4K, punctuation) and maps network aliases (Sportsnet/SN, TVA Sports, TSN 1–5, ESPN, ABC, TNT, NHL Network, RDS, etc.), ranked by match strength, max 10. Uses the existing saved channel list, no extra provider calls.
- UI: `GameSuggestionCard` rendered in `global-search.tsx` and `tv.live.tsx` search results, only after search is confirmed (existing SearchField behaviour), query length ≥ 3; own remote row, channels as action-only focus targets.
- Unit tests for the channel matcher (Sportsnet variants, TVA, prefixes, no false match on "Sports Bar" etc.).
