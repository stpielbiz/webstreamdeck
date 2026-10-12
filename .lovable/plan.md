# Update channels button in Live TV

## Why you got a different feed
Sports channels like NHL event feeds are often re-assigned by the provider during the day: the same channel number or name can point to a different game. The app keeps your channel list saved on the TV (up to 30 minutes before checking again), so after a drop it can reopen an old link that now carries another feed.

## What changes
1. **"Update channels" replaces "Full screen"** in the Live TV guide (Fire TV and website). Pressing OK on the channel still opens full screen, so nothing is lost.
   - Pressing it fetches a fresh channel list for the current category straight from your provider, replaces the saved copy, and shows "Channels updated" (or a clear error).
   - The channel you were on stays selected if it still exists (matched by its ID, then by name).
2. **Extra fix: fresh link on reconnect.** When a live channel drops and the player reconnects (the auto-recovery added last time), it first asks the provider for a fresh stream link for that channel instead of reusing the old one. This is the most likely fix for the wrong-feed problem, even without pressing the button.
3. **Sports/event categories refresh more often**: categories whose name includes words like NHL, NBA, NFL, MLB, Sports, Events, PPV are re-checked every 5 minutes instead of 30 when you open them.

## Technical details
- `src/routes/_authenticated/tv.live.tsx` line ~469: swap the Full screen button for `Update channels` (`data-tv-focus`, spinner while running) calling `queryClient.fetchQuery` with `staleTime: 0` for `["tv-live-items", activeId, effectiveCategory]` and the live categories, writing results to the device cache (`device-cache.ts`) and invalidating `["playback", activeId, "live", selected.id]`. Re-select by id, else by normalised name.
- Event-category detection sets `staleTime` to 5 min for those queries.
- Web `live.tsx`: same button in the channel header.
- Reconnect re-resolve: `VideoPlayer` gets an optional `onRefreshSource` that the live screens implement by refetching playback; on fatal error/stall it awaits it before retrying. Native `PlayerActivity.kt`: on reconnect, call back to the web layer through the bridge (`onPlayerNeedsUrl`) and wait up to 5s for a new URL, else retry the old one. Native part needs the next app update.
