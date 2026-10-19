# Pick a network, then see its channels (NHL today and other leagues)

## What changes
Under each game, the "On: ESPN+, NBC Sports BA, Sportsnet, TVA Sports, RDS, TSN" text becomes a row of network buttons.

```text
San Jose Sharks at Montreal Canadiens   7:00 PM
[ All ] [ ESPN+ ] [ NBC Sports BA ] [ Sportsnet ] [ TVA Sports ] [ RDS ] [ TSN ]
[card] [card] [card] [card]      <- channels for the selected network
```

- Each network button shows how many of your channels match it (e.g. "Sportsnet · 6"); networks with none are dimmed but still shown as "none".
- "All" (default) shows a mix: the best few channels from every network instead of 8 ESPN+ cards, so Sportsnet, TSN, RDS also appear up front.
- Press OK on a network to show only its channels underneath (up to 16).
- Remote: Down from the game title lands on the network row; Left/Right move between networks; Down goes into the channel cards; Up from the cards returns to the network row; Up/Down between games still works.
- ESPN+ numbered event channels (like "ESPN+ 005 UTSA Weekly") are ranked lower than real channels, since they rarely carry the game.

## Technical details
- `src/lib/channel-suggest.ts`: add `channelsByNetwork(game, channels)` returning `{network, items}[]` per broadcast; "All" interleaves round-robin; demote names matching numbered-event patterns (`espn+ \d+`, `ppv \d+`, `event \d+`). Add bun tests.
- `src/components/sports-schedule.tsx`: per-game selected network state; network chip row (`data-sport-network`), cards grid filtered; extend the existing onKeyDown spatial handling to include the chip row as its own row.
- Same picker reused in the "Game on" search card (`game-suggestion.tsx`).
- Website change only; no app update.
