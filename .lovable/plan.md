# Automatic stream recovery for live channels

## What changes for you
When a channel freezes, drops, or stops on its own, the player notices and reconnects to the same channel automatically. A small "Reconnecting..." note shows while it does this. You don't need to press Back or pick the channel again. You only see an error if the channel still won't come back after several tries in a row.

## How it recovers
- **Stream error** (provider drops the connection): reconnect right away, then wait 2s, 4s, 8s and so on, up to about 30s between tries. Keep trying for about 3 minutes before showing "Your provider stopped this channel".
- **Frozen picture** (stuck loading, or the picture stopped moving for more than 12 seconds while it should be playing): reload the channel.
- **Stream "ended"** on a live channel (some providers close the line): reconnect instead of closing.
- Once the channel has played well for 60 seconds, the retry count starts over, so the next drop also gets a full set of tries.
- Both stream formats still get tried (the current .m3u8/.ts switch), and the player cycles through them on each retry.
- Movies and episodes: also reconnect after a drop, and pick up where they stopped instead of starting again.

## Where
- Fire TV app player (the main fix; needs the next app update to install).
- Website player (same rules for browsers; works once published).

## Technical details
- `PlayerActivity.kt`: replace the one-shot `onPlayerError` fallback with `scheduleReconnect()` (exponential backoff, keeps `candidates` and rotates through them, stops after about 3 min of failures). Add a `stallWatchdog` Runnable every 3s: if `playWhenReady` and (`STATE_BUFFERING` > 12s, or `currentPosition` unchanged > 12s while `STATE_READY`), reconnect. For live, `STATE_ENDED` reconnects. VOD reconnect seeks to the last known position. Reset attempts after 60s of steady playback. Small overlay `TextView` "Reconnecting..." over the `PlayerView`. Back still closes immediately and cancels pending retries.
- `src/components/video-player.tsx`: same logic for hls.js (`ERROR` fatal → `startLoad`/`recoverMediaError`, then full reattach with backoff) and native `<video>` (`stalled`/`waiting`/`error` + `timeupdate` watchdog), with a "Reconnecting..." overlay.
- No database or account changes.
