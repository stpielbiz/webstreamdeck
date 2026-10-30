# Live TV: keep scrolling past 40 channels

## What happens now
Fire TV Live TV shows channels in groups of 40. After the 40th there is a "Next group of 40 channels" row, but it's easy to miss or not reachable with the remote, so the list seems to stop.

## Change
- Pressing Down on the last channel of a group loads the next group automatically and focuses its first channel. Pressing Up on the first channel of a later group goes back to the previous group's last channel.
- The next-group row stays as a backup and is always reachable with Down.
- The "Channels 41–80" counter keeps showing where you are.
- TV guide listings for the new group load as they do now.
- Coming back from playback still lands on the channel you were watching.

## Technical details
- `src/routes/_authenticated/tv.live.tsx`: on ArrowDown at the last channel row (or ArrowUp at the first row when page > 0), call `setPage` and after render focus `[data-focus-key="channel-<id>"]` of the first/last row of the new page.
- Make sure the "Next group" button is part of the remote row order (check `data-remote-row` / zone rules).
- Verify with Playwright on a category with more than 40 channels.
