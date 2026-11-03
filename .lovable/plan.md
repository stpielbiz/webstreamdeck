# More precise NFL channels (Sports package)

## Why NFL is imprecise today
- The schedule lists NFL networks as just "CBS", "FOX", "NBC", "ABC", "ESPN", "Prime Video", "Netflix", "NFL Network". Our matcher has no NFL-specific spellings, so "FOX" matches every channel with "fox" in it (FOX News, FOX Business, FS1, local FOX stations everywhere).
- Sunday CBS/FOX games are regional: only the stations in each team's home market (plus some other regions) carry them, but we show all CBS/FOX stations.
- Canadian viewers watch NFL on TSN, CTV and RDS, which the schedule never lists.

## What changes
1. **Network-correct spellings for NFL**: CBS, FOX, NBC, ABC, ESPN/ESPN2, Prime Video, Netflix, Peacock, NFL Network, NFL RedZone. Exclude news/business/entertainment look-alikes (FOX News, CBS News, NBC News, MSNBC, FOX Business, ABC News, FX, etc.).
2. **Home-market stations first**: each NFL team gets its market and local station call letters (e.g. Giants/Jets: New York, WCBS/WNYW/WNBC/WABC; Bills: Buffalo, WIVB/WUTV...). For a CBS/FOX/NBC/ABC game, stations in either team's market show at the top as "Local to [team]", then other stations of that network. National windows (Thursday Prime, Sunday night NBC, Monday ESPN/ABC) keep showing all matching feeds.
3. **Canada simulcast**: add TSN, CTV and RDS as "Canada (likely)" for NFL games, ranked below the official networks and still under the existing (beta) label.
4. **NFL RedZone**: on Sunday afternoon windows, add RedZone as its own option when the playlist has it.
5. Keep "This game" team-named channels at the top, as today.

## Limits (stays beta)
- Regional maps change weekly; using team markets is a strong guess, not the official coverage map. If useful later, we could read the weekly 506 Sports coverage maps, but that site has no clean feed and may break.
- Matching depends on how the provider names channels (call letters or city in the name help most).

## Technical details
- `src/lib/channel-suggest.ts`: NFL aliases, exclusion list, `NFL_MARKETS` table (32 teams → city words + call letters), market-aware ranking, Canada simulcast group, RedZone.
- `src/lib/game-broadcasts.functions.ts`: keep ESPN `broadcasts`/`geoBroadcasts` (market type + region) so national vs regional can be told apart.
- Tests in `src/lib/channel-suggest.test.js`: FOX News never matches a FOX game; a Giants home game ranks WNYW/FOX 5 New York first; a Monday ESPN game lists ESPN and not ESPN+ event feeds; Canadian TSN appears only as "likely".
