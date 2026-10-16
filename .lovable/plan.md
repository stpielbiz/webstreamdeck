# Live TV: first OK previews, second OK goes full screen

## What you'll see

In Live TV (Fire TV and web):

- **First press** on a channel starts the **small preview** at the top of the guide — the channel plays in the little box while you keep browsing.
- **Second press on the same channel** opens it **full screen**.
- Pressing a **different** channel switches the preview to that channel instead.
- Back stops the preview and returns focus to the channel.

Today on Fire TV the first press jumps straight to full screen and the preview box only says "Press OK to watch" — this change makes the preview actually play.

## How it works (technical)

- `src/routes/_authenticated/tv.live.tsx`:
  - `playChannel`: remove the `setFullscreen(hasNativePlayer())` shortcut so the first press always selects the channel and shows the preview; the existing "same channel again → full screen" branch stays.
  - Preview box: replace the "Press OK to watch" placeholder on Fire TV with the real in-page `VideoPlayer` (`allowNative={false}`), same as the web. The preview uses the app's relay link, which the Fire TV WebView fetches itself.
  - If the preview can't play on a given provider (some only serve the device player), the player's existing error handling shows its message and the second press still opens the native full-screen player, which keeps working as today.
  - Full screen on Fire TV still hands off to the native player (`allowNative` default), so the TiviMate-style recents bar and reconnect behaviour are unchanged.

## Notes

- Website change only — works on publish, no new Fire TV app update needed.
- If it turns out your provider refuses the in-page preview on Fire TV, tell me and I'll make the first press fall back to the native player automatically.
