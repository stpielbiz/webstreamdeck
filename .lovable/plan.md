# Team-named channels and NHL Network in league games

## What changes
Under each game, the network buttons get two new options at the front:

```text
Maple Leafs at Sharks   7:00 PM
[ All ] [ This game · 2 ] [ NHL Network · 1 ] [ Sportsnet+ ] [ TVA Sports ] ...
```

- **This game**: channels whose name mentions a team playing, e.g. "NHL 05: Maple Leafs vs Sharks" or "USA NHL | Toronto Maple Leafs". It appears only when at least one channel matches.
- **NHL Network**: always shown for NHL games, even when the official schedule doesn't list it.
- **All** puts the "This game" channels first, then mixes in the other networks as it does now.
- Short team nicknames that are also everyday words ("Jets", "Kings", "Stars", "Wild") only count when the channel name also looks like a sports feed: it has "NHL", "vs", "@" or "at", or both teams' names. That keeps channels like "Kings TV" out.
- The "Game on" search card uses the same order, so team-named channels come first there too.
- Other leagues get "This game" too (for example "NBA 03: Lakers vs Celtics"). Each league's own network (NBA TV, NFL Network, MLB Network) is added the same way as NHL Network.

## Technical details
- `src/lib/channel-suggest.ts`: new `gameFeedChannels(game, channels)` that matches the full team name (`displayName`) anywhere, and the nickname alone only when the name also contains a league/vs/@/at marker or the opponent. In `channelsByNetwork`, put a "This game" group first when it has matches, and add the league network (`NHL Network`, `NBA TV`, `NFL Network`, `MLB Network`) when it's missing. `suggestChannels` already round-robins the groups, so team feeds lead "All". Reuse the cached cleaned names (WeakMap).
- Aliases: `"nba tv"`, `"nfl network"`, `"mlb network"`, plus `"nhl network"`, which is already there.
- `sports-schedule.tsx`: no layout change. The chip row already renders whatever groups it's given.
- Tests in `channel-suggest.test.js`: "NHL 05: Maple Leafs vs Sharks" lands in "This game"; "Kings TV" doesn't match a Kings game; NHL Network is present for an NHL game with no listing.
- Website only; no app update.
