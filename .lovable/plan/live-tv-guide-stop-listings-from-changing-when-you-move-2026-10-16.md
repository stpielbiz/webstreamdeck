# Live TV guide: stop listings from changing when you move

## What's going on
Your provider sends overlapping listings for the same channel. For channel 4361, for example, it lists "MLB Baseball 10:00 PM–12:00 AM" and also "Sportsnet Central 11:00 PM–12:00 AM". The guide draws both boxes in the same spot:
- When the row isn't selected, "Sportsnet Central" is drawn on top.
- When you move onto the row, the selected box ("MLB Baseball") jumps to the front.

That's why the listing seems to change as you move. The top line ("On now") also picks the older entry, so it says MLB while the channel is actually showing Sportsnet Central. The channel that plays is the right one. Its listing was just misleading.

## What changes
- When two listings overlap on a channel, the newer one wins from the moment it starts. The older one is cut short at that point, so MLB Baseball shows 10:00–11:00 PM and Sportsnet Central shows 11:00 PM–12:00 AM.
- Exact duplicates are removed.
- Each moment shows one listing per channel, and it stays the same whether the row is selected or not.
- "On now" at the top always matches the box under the live-time line.
- This applies to every channel and category, not just favourites.

## Technical details
- Add `normalizeSchedule(programmes)` (in `src/lib/iptv-provider.ts` or a small shared helper):
  - sort by start;
  - drop entries with the same start and title;
  - if an entry starts before the previous one ends, clip the previous end to that start;
  - drop entries whose length becomes 0 or less.
- Apply it when building `scheduleMap` in `tv.live.tsx`, so saved guide data is fixed too. Also apply it in `xtreamSchedule`, so newly saved data is clean.
- The web `live.tsx` and `guide-view.tsx` read now/next separately. When a channel has more than one "now" entry, pick the one that started most recently.
- Website-only change; no app update needed.
