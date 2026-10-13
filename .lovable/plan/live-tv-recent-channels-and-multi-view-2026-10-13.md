# Live TV: Recent channels and Multi-view

## How TiviMate does multiple screens
TiviMate's "Multi-view" runs several video players side by side inside its own app (not Android's system Picture in Picture). Each screen is its own player connected to its own stream; only the selected screen plays sound. We can do the same in the Fire TV app.

Limits to know:
- Each screen uses one provider connection. Many plans allow only 1-2 at once, so extra screens may fail with "too many connections".
- Firesticks are weak: 2 screens is safe, 4 only on Fire TV Cube / 4K Max and with HD (not 4K) channels.

## 1. Recent channels
- New "Recent" category at the top of the Live TV category list (Fire TV and web), above All channels.
- Shows your last 10 channels watched, newest first; hidden when empty.
- Saved per account and playlist, so it follows you across devices.

## 2. Multi-view (Fire TV app)
- In the full-screen player, a new "Add screen" option (press Menu or Up) opens a small channel picker (Recent + Favourites + search).
- Layouts: 2 screens side by side, or up to 4 in a 2x2 grid.
- Left/Right/Up/Down moves between screens; the selected screen gets a highlight and its sound. OK on a screen makes it full screen; Back returns to the grid, Back again closes multi-view.
- Each screen keeps the automatic reconnect.
- Web browser: Multi-view on the web Live TV page with the same 2/4 layout; the browser's built-in PiP button stays available on computers and phones.

## Technical details
- New table `recent_channels` (user_id, playlist_id, item_id, title, logo_url, watched_at; unique per user/playlist/item), RLS owner-only + grants; server fns `listRecentChannels` / `touchRecentChannel` (trim to 10). Called from `playChannel` in `tv.live.tsx` and selection in `live.tsx`; "Recent" pseudo-category renders from that list.
- Native: new `MultiViewActivity.kt` with up to 4 `PlayerView`s each owning an ExoPlayer (reusing PlayerActivity's reconnect logic, extracted to a shared helper); volume 0 on unfocused players; DPAD focus between views. Bridge `StreamDeckNative.playMulti(json)` with list of {url,title}; channel picker stays in the website, which calls `playMulti` with the updated list. Register activity in AndroidManifest. Requires a new APK.
- Web: grid of `VideoPlayer` instances muted except the focused one.
- Show a clear message if a screen fails to connect (likely connection limit).
