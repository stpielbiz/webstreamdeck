# Fix: nothing loads or plays in the Fire TV app

## What we know
- TiviMate plays the same account fine on the same Firestick, so the account and provider are working.
- The app's server requests in the last hour all came back "OK" without crashing. That likely means the provider is sending back empty lists or refusals, and the app shows them as empty menus without saying why.
- The most likely cause is the same one behind the recent 403 when adding a playlist: the provider now refuses connections from our servers (they run in a data centre) and only accepts home or device connections. That isn't confirmed yet, so checking it is step 1.

## Steps
1. **Confirm the cause.** Test the active playlist (Shark1) from our servers: login check, channel list, movie list and one stream. Record exactly what the provider answers (refused, empty, timeout, or a changed server address).
2. **Stop hiding the problem.** When the provider refuses or returns nothing, the menus show a clear message ("Your provider is refusing our servers right now…") with a Retry button, not an empty screen. Your saved library stays on screen and is never replaced by an empty list.
3. **Load from the Firestick itself (the real fix if step 1 confirms the block).** The Fire TV app downloads channels, movies, shows and the guide straight from the provider over the Firestick's own connection, with your VPN, the way TiviMate does. Our servers are only used as a backup. Browsers keep the current method.
4. **Playback.** Make sure Play always gives the stream address straight to the built-in Firestick player, and is never held up by a failed server check.
5. **Test** in the preview, then publish. A new Firestick app version will be needed for step 3. It installs through the in-app "Check for updates".

## Technical details
- Step 1: call the provider's player_api (user info, get_live_streams, get_vod_streams) from a server function and log the status and body length. Compare with the stored `base_url`.
- Step 2: in `iptv.server.ts`/`iptv.functions.ts`, have list functions return a typed `{ refused: status }` instead of `[]`. `library-sync.tsx` already keeps the cached copy when it gets nothing back; surface the error in `catalog-workspace.tsx` and `tv.live.tsx`.
- Step 3: add `StreamDeckNative.fetch(url) -> Promise<text>` to `MainActivity.kt` (OkHttp/HttpURLConnection on device, TiviMate user agent). Add a client-side Xtream fetcher used when the bridge exists, with results parsed by the existing shared parsers. The playlist credentials request goes only to the signed-in owner's device.
- Step 4: check that `getPlayback` returns `directUrl` without first probing the provider when running in native mode.
