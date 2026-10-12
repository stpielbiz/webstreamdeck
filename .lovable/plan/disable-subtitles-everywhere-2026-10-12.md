# Disable subtitles everywhere

Shows and movies from providers can carry subtitle tracks. Today nothing turns them off, so they appear on their own. The goal: subtitles are always off — no subtitle button, no automatic captions — on both the website player and the Fire TV app player.

## Changes

### 1. Web player — `src/components/video-player.tsx`

- When creating the hls.js instance, set `subtitleDisplay: false` so hls.js never renders HLS subtitle tracks on the video.
- After attaching a stream (and again on `loadedmetadata`), walk `video.textTracks` and set every track's `mode` to `"disabled"` — this covers subtitle tracks exposed by the browser for progressive MP4/MKV playback too.
- Re-apply the disable step when a new source attaches (the source-change effect already exists; add the call there) so a stream that starts after another one stays subtitle-free.

### 2. Fire TV app player — `native-app/android/app/src/main/java/app/streamdeck/tv/PlayerActivity.kt`

- After building the ExoPlayer, set track selection parameters that disable the text track type (`setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)`), so Media3 never selects or renders subtitles.
- This needs no UI change: the player's control overlay simply offers no subtitle track.

### 3. Native handoff (no change needed)

- The `StreamDeckNative.play` bridge and external-player links (VLC/MX Player) are untouched; those players use the device's own subtitle settings, which we can't control.

## Rollout notes

- Website change takes effect on publish.
- The Fire TV change only lands with a new APK (built by the existing Android workflow); users must update the app to get subtitle-free playback on device.
- No settings or database changes — subtitles are simply off for everyone.

## Verification

- Typecheck/build passes.
- Playwright check on a stream page: `video.textTracks` all report mode `disabled` after the source attaches, and no subtitle cues render.
- Native change is code-verified only (device testing stays with you on the next APK install).
