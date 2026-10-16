# Remove recent-channel shortcuts during movie/show playback

## Problem

When a movie or show is playing on Fire TV, pressing Down opens the "recent channels" bar (the last-watched live channels) instead of helping fast forward / rewind. That bar should only exist for live TV.

Root cause (confirmed in `native-app/android/app/src/main/java/app/streamdeck/tv/PlayerActivity.kt`):
- The `KEYCODE_DPAD_DOWN` handler always calls `showRecentBar()` — it never checks whether the current stream is live (`live` flag, set from the `EXTRA_LIVE` intent extra).
- `PlayerActivity.recentChannels` is a static list that is only filled from Live TV via the `setRecentChannels` bridge call, so it stays populated when a movie or show starts — stale live-channel tiles appear over VOD playback.

The web player is not affected: the recents strip is only rendered when the `recents` prop is passed, and only Live TV (`tv.live.tsx`) passes it.

## Changes

All in `native-app/android/app/src/main/java/app/streamdeck/tv/`:

1. **PlayerActivity.kt — gate the recents bar on live streams**
   - In `showRecentBar()`: return immediately when `live` is false (safety net).
   - In the `KEYCODE_DPAD_DOWN` handler in `dispatchKeyEvent`: when `live` is false, let Down fall through to `super.dispatchKeyEvent(event)` so Media3 shows the controls and the user can navigate to the seek bar (fast forward / rewind). Only live playback toggles the recent bar.

2. **MainActivity.kt — clear stale recents for non-live plays**
   - In the `play` bridge handler, when the request has `live == false`, set `PlayerActivity.recentChannels = emptyList()` before launching the player, so no leftover live-channel list survives into a movie/show session.

## Verification

- Build the Android project (`./gradlew assembleDebug` or the existing build step) to confirm it compiles.
- Note for the user: this is a Fire TV app change, so it reaches the device with the next APK release — the website itself needs no update (web already hides the bar for movies/shows).
