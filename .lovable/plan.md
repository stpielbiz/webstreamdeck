# Get website updates without force-stopping the Fire TV app

## What changes for you
- **Check for updates** (bottom of the TV home menu) now also reloads the app with the newest published version, after checking for a new Fire TV app. You'll see a short "Refreshing…" message, then the app opens back on Home.
- When you come back to the Stream Deck app after it was in the background for a while (about 30 minutes), it quietly checks if a newer website version is published and reloads only if there is one, so a force stop is no longer needed.
- Nothing you saved is lost: favourites, watch history, saved library data, and settings stay on the device.

## Technical details
- `src/routes/_authenticated/tv.index.tsx` `checkForUpdates`: call native check (if present), then show a toast and run a shared `hardReload()` after ~1.5 s (or immediately if no native app update was started).
- New `src/lib/hard-reload.ts`: clears Cache Storage (`caches.keys()` → delete) and reloads at `location.pathname` with a `?v=<timestamp>` cache-buster so the WebView fetches fresh HTML/JS. IndexedDB (library cache) is untouched.
- Native `MainActivity.kt`:
  - On launch, `webView.clearCache(false)` so stale cached site files aren't reused (IndexedDB/localStorage kept).
  - Track time in background; in `onResume`, if away more than 30 min, `webView.reload()` with `LOAD_NO_CACHE` for that load, but skip while the player is open.
  - New bridge `reloadApp()` that clears the WebView cache and reloads; `hardReload()` uses it when available.
- Web part works on publish; native auto-refresh needs the next APK.
