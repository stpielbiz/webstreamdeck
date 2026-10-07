# Live TV: preview first, then full screen; Back returns to the same channel

## 1. Small preview, then full screen
- First OK on a channel (or one of its programmes) starts a small live preview at the top of the guide, above the timeline, with the channel name and the current programme. The guide stays visible and remote-navigable under it.
- Moving to another channel does not change the preview; only OK does.
- Pressing OK again on the channel already previewing opens full screen (the Fire TV player in the app, the large player in a browser).
- Back from full screen returns to the preview with the same channel still playing and focused. Back again stops the preview and stays on that channel row. Back once more returns to the categories, as today.

## 2. Back keeps your place
- After closing full screen or the preview, focus returns to the exact channel row you opened, and the guide stays scrolled to it (no jump to the first channel).
- The category, page of channels, and search text are kept.

## Technical details
- `tv.live.tsx`: split `selected` into `previewId` (inline player in a fixed-height strip above the grid, `data-tv-zone="live-preview"`) and `fullscreen` boolean. `playChannel(item)`: if `previewId === item.id` set fullscreen (native: `StreamDeckNative.play`), else set preview. Remove the auto-focus of the close button on preview start so focus stays on the channel.
- Likely cause of the jump: `closePlayer` is captured by the player's close callback with a stale `focusedId`, so nothing gets focused and focus falls back to the first entry. Fix by tracking the last opened channel in a ref, focusing `channel-<id>` with `preventScroll` then `scrollIntoView({block: "center"})`, and also restoring it on the native `streamdeck-back` / `__streamDeckClosed` path. Confirm with Playwright using the native test double.
- Ensure the mount-only "focus All channels" effect and category-change scroll reset never run on player close.
