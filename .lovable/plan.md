# Live TV: one continuous channel list

## What changes
- A category becomes one long list. You start with 40 channels, and the next 40 get added underneath as you get close to the bottom. Nothing jumps or refreshes, and focus just moves down to the next channel.
- The "Next channels" and "Previous channels" rows are removed.
- The counter at the top shows "Showing 80 of 312 channels".
- TV guide listings load for newly added channels as they appear.
- Coming back from playback still lands on the channel you were watching, and the list keeps enough channels loaded to include it.
- Changing category or search starts again at the top with 40 channels.

## Technical details
- `src/routes/_authenticated/tv.live.tsx`: replace `page` with `limit` (starting at 40). `visibleChannels = channels.slice(0, limit)`. When a focused row index is within 10 of `limit`, run `setLimit(l => min(channels.length, l + 40))`. Remove the ArrowUp/ArrowDown page-switch handler and the pagination rows. Restore-on-return sets `limit` to at least the restored index + 40. Reset `limit` wherever `setPage(0)` is called now.
- Guide fetching already reads from `visibleChannels`, so it extends with the list. Rows stay lightweight, and the list is capped by the category size.
