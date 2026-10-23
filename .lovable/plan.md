# Sports package: networks first, channels on demand

## What you'll see
Each game in **NHL today** (and other leagues):
```text
Leafs at Sharks   7:00 PM
[ This game · 2 ] [ Sportsnet · 4 ] [ TVA Sports · 1 ]
   (no channel cards until a network is pressed)
```
- **Collapsed by default:** only the game and its network buttons show. No channel cards yet.
- **OK on a network:** opens that network's channels right under it. OK again on the same network closes them. Opening another network switches to it.
- **Networks with 0 channels are hidden.** The "All" button goes away. If no network has channels, the game shows "No matching channels in your playlist."
- **Finished games can be selected:** the remote stops on the final score card, so with 10 games you can scroll through every result. OK on it does nothing.
- Back from a playing channel still returns to the channel card you picked (its network stays open).

## Technical details
- `src/components/sports-schedule.tsx` GameBlock: `network` state starts `null` (collapsed); chips built from `groups.filter(g => g.items.length)` with no "All" entry; clicking the active chip sets `null`; channel grid renders only when a network is selected. Drop the `mix` list here.
- Restore-focus: when returning from playback, the saved key `sport-<game>-<item>` belongs to a closed network — keep the selected network per game in a module-level map (by game id) so it survives the remount and the card is found again.
- FinalBlock: make the section a focusable `button`-like element (`data-tv-focus data-sport-item data-focus-glow` with a focus ring) so the existing spatial onKeyDown includes it; no onClick action.
- Zone entry: the first game (finished or not) gets `data-zone-entry` / `sports-first-card` on its first focusable element.
- `game-suggestion.tsx` unchanged.
- Website change only; no app update.
