# Recent-channel buttons: square tiles with a glowing focus

## What you'll see

While a channel is streaming, pressing Down brings up the recent-channel bar along the bottom. The buttons become proper square tiles:

- Every tile is the same size — a fixed square, so the row lines up evenly instead of stretching to each name's length.
- The channel name sits centred inside the tile and wraps onto two lines, so long names read in full instead of being squeezed or cut.
- Tiles are much thicker than today's thin pills, so they're easy to see from across the room.
- When a tile is selected it grows slightly and a bright ring fades in around it, so the highlighted channel is unmistakable. Moving along the row the ring slides from tile to tile.

Everything else stays as it is: Down shows the bar, Left/Right walks along it, OK switches channel, Back or Down hides it, and it disappears on its own after 5 seconds.

## Where it changes

**Fire TV app** — the app's own player draws this bar, so it needs the next app update (APK) installed.

**Website** — the same treatment is applied to the equivalent strip in the web player, so both look and behave alike. This part arrives when you publish.

## Things to know

- The bar carries only the channel name and its link, so tiles show the name only — no channel logo. If you'd like the logo inside each tile, that's a small follow-up on both sides.
- Names longer than two lines end with "…" rather than being clipped mid-word.

## Technical details

**Fire TV (`native-app/android/app/src/main/java/app/streamdeck/tv/PlayerActivity.kt`)**
- `showRecentBar()` (lines 290-310) currently builds plain `android.widget.Button(this)` with no size, and swaps the background colour instantly on focus.
- Replace each tile with a fixed `dp(160) x dp(160)` square: `maxLines = 2`, `ellipsize = END`, `isAllCaps = false`, centred gravity, `movementMethod` not needed, text size raised for TV viewing distance.
- Draw the tile background as a `GradientDrawable` (rounded rect, muted fill, thin stroke); the focused state uses the accent stroke plus raised elevation.
- Animate focus with `view.animate().scaleX(1.08f).scaleY(1.08f).setDuration(150)` on focus gain and back to `1f` on loss, so the ring appears as the tile grows.
- Set `clipChildren = false` / `clipToPadding = false` on `recentRow` and `recentBar` (lines 153-165) and add vertical padding so a grown tile isn't clipped by the scroll view.

**Website (`src/components/video-player.tsx`, recents strip at lines 650-665)**
- Swap the current `shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs` pill for a fixed `size-40` (160px) square tile: `shrink-0`, centred flex layout, `line-clamp-2 break-words`, text sized for TV distance.
- Focus styling uses the existing theme tokens: `focus:bg-primary focus:text-primary-foreground`, `focus:ring-4 focus:ring-primary/70`, plus a soft `focus:shadow-[0_0_28px_-2px] focus:shadow-primary/50` glow.
- Add `transition-[transform,box-shadow,background-color] duration-150 ease-out` and `focus:scale-105` for the grow; keep `outline-none` so only the ring shows.
- Keep `tabIndex` gating, `data-tv-focus`, and `onPickRecent` exactly as they are.

**Verification**
- Website: drive the player with Playwright, open the strip, and confirm every tile reports the same width and height, the full name is visible on two lines, and the focused tile carries the ring and scale transform.
- Fire TV: the Kotlin changes compile; on-device behaviour needs the next APK.
