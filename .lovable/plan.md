# Fix: Live TV preview never plays on Fire TV

## Root cause

The video player has a rule that says "inside the Fire TV app, don't load any stream in the page — the native player handles it." That rule was meant for full-screen playback, but it also runs for the small preview box, so the preview sits on the big play button forever and never starts.

## What you'll see after the fix

- First press on a channel: the small preview **actually starts playing** at the top of the guide (it begins muted if the device blocks sound-on autoplay, with a tap-to-unmute hint — same as the website).
- Second press on the same channel: full screen in the native player, exactly as today.

## How it works (technical)

- `src/components/video-player.tsx`: the early return in the source-attach effect (`if (hasNativePlayer() && fallbackRef.current) return;`) is gated on `allowNative`, so players created with `allowNative={false}` (the Live TV preview, Multi-view screens) attach and autoplay their stream inside the WebView, while the full-screen player still hands off to the native app player.
- No other changes: autoplay already retries muted when the device blocks sound, and the native full-screen path is untouched.

## Notes

- Website change only — works on publish, no new Fire TV app update needed.
- If your provider refuses the relayed stream on the Firestick, the preview will show its error message and the second press (native full screen) remains the way to watch — tell me if that happens and I'll add an automatic fallback.
