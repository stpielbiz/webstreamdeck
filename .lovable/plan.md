# Record tomorrow's shows from the TV guide

## How far ahead the guide goes today
- Jolzplay already downloads each channel's full schedule from your provider. Most providers send 1 to 3 days ahead, some up to 7.
- The Live TV guide only shows the next 12 hours, so tomorrow's shows are hidden even when they have been downloaded.
- Record later starts one hour from now, rounded to the quarter hour, and ignores the show listed at that time.

## What changes
1. **The guide reaches into tomorrow**
   - You can scroll the Live TV guide right until the end of tomorrow, or further when your provider sends more days.
   - A day label ("Today", "Tomorrow") appears at midnight on the timeline so you know which day you're looking at.
   - If the guide has nothing listed further ahead for a channel, that row stays empty. No new downloads are needed.

2. **Record a show right from the guide**
   - Hold OK (or right-click) on any upcoming show in the guide to get "Record this show".
   - The recording is set to the show's own start and end, starting 1 minute early and ending 2 minutes late so nothing is cut off. You confirm on the usual length screen, where the time can still be changed.
   - A show that is already on records from now until it ends.

3. **Record later follows the guide**
   - Holding a channel and choosing Later now starts on the next show on that channel instead of "one hour from now".
   - New "Previous show" and "Next show" buttons jump between that channel's listed shows, including tomorrow's. The day, hour and minute buttons still work for exact times.
   - When nothing is listed in the guide, Later behaves as it does today.

Recording itself is unchanged: it still only works on the Fire TV app and uses the same storage check. These changes work once you publish the site, with no Fire TV app update.

## Technical details
- `tv.live.tsx`: replace the fixed `GUIDE_HOURS = 12` with a window that ends at the later of the end of tomorrow or the last cached programme (capped at 7 days). Only programmes inside the visible scroll range are rendered, to keep the Fire Stick fast. Add midnight day markers.
- Programme blocks: add a long-press/context-menu handler that opens `ChannelActionMenu` with a new `programme` prop (`{ title, start, end }`), jumping straight to the length step with start = max(now, start − 1 min) and end = end + 2 min.
- `channel-action-menu.tsx`: `chooseLater` defaults to the next programme start from a new `programmesFor(channel)` list. Add Previous/Next show steppers that snap to programme starts, and give the menu a recording title taken from the programme.
- Test: the default start and end for a show in progress, an upcoming show, and a channel with no guide.
