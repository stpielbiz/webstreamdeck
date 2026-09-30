# Auto-open streams in an external player when the browser can't play them

## Goal
When a stream (live TV, movie, or show) can't play in the browser, the app automatically launches it in VLC (or the device's external player) without the user clicking anything. Manual buttons stay as a fallback.

## Changes

### 1. Auto-launch on failure — `src/components/video-player.tsx`
- When playback reaches the final error state (both the relayed stream and the direct provider link have failed), automatically trigger the external player link for the current device:
  - Android/Fire TV: the `intent://` VLC link (falls back to MX Player if VLC isn't installed — Android handles this).
  - iPhone/iPad/Mac: the `vlc-x-callback://` link.
  - Windows/Xbox/other: the `vlc://` link.
- The launch is done by navigating a hidden iframe / `window.location` to the external URL — this works without a click on Android and most desktop browsers.
- Show a clear status screen while this happens: "Opening in VLC…" with a spinner, plus the existing manual buttons (Play in VLC, Play in MX Player, Copy stream link) in case the auto-launch is blocked or the app isn't installed.
- Guard against loops: auto-launch fires only once per stream (tracked per source URL), never repeatedly.

### 2. Return-to-app behaviour
- After auto-launching, the on-screen message tells the viewer to come back to the app when done, and the "Copy stream link" button remains for devices where no external player is installed.
- Watch-progress note: progress is still only saved for in-browser playback; a short line on the screen sets that expectation for VLC viewing.

### 3. Keep manual control
- The VLC button in the player controls and the error-screen buttons stay unchanged, so users can always relaunch manually.

## Technical notes
- Only `src/components/video-player.tsx` changes; it already has `externalPlayerLinks()` and device detection from `src/lib/external-player.ts`.
- No backend, database, or routing changes.
- Verified with a typecheck, a clean build, and a Playwright run confirming the auto-launch fires on stream failure and the status screen renders.
