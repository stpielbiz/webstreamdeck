# Smooth NHL today: animation first, no freeze

## What you'll see
- Highlighting **NHL today** (or any league) shows the league logo animation right away, even when today's games are already saved.
- Games then appear one by one without locking the remote; you can keep moving up/down the category list while they fill in.
- Moving past a league quickly (e.g. down to Recent) no longer stalls the screen.

## Cause (confirmed in code)
With games saved for the day, the panel draws everything instantly on focus. For every game it scans your whole channel list several times (each network, the "All" mix, team names, league name), re-cleaning every channel name each pass. 15 NHL games x thousands of channels all runs in one go before the screen can update — that's the freeze, and why the old "Recent" view stays on screen.

## Changes
1. **Clean channel names once**: prepare a cleaned-name list once per playlist and reuse it for all games and leagues, instead of per game and per network.
2. **Build "All" from the network lists already computed** rather than recomputing them.
3. **Wait before building**: when a league is only highlighted, show the logo animation and start matching after a short pause (~300 ms); if focus moves on, nothing heavy runs.
4. **Fill in game by game**: match channels for one game at a time, yielding to the remote between games; each game shows a shimmer card until its channels are ready.
5. **Cheaper saved-list read**: read the day's saved games once per league, not on every redraw.
6. Add a log step "Sports matching: N games in X ms" so we can confirm on your Fire Stick.

## Testing
Yes — after publishing, turn on logs, hover NHL today and open it; I'll check the timing lines and freeze warnings. Add a small test that the cleaned-name matching gives the same channels as before.

## Technical details
- `channel-suggest.ts`: `prepareChannels(items)` -> `{item, n}[]` memoized by array identity (WeakMap); `channelsByNetwork`/`suggestChannels` accept prepared input; suggestChannels reuses groups.
- `sports-schedule.tsx`: `readStored` in `useMemo([key])`; debounce render via `useDeferredValue` + 300 ms timer; per-game matching queued with `yieldToPage()` from background-gate; `trace()` timing.
- Test in `src/lib/channel-suggest.test.js`.
