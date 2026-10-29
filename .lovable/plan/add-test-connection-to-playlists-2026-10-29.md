# Add "Test connection" to playlists

## What the user gets
Each saved playlist on the Playlists screen gets a **Test** button next to Use / Edit / Delete. Pressing it checks the playlist right away and shows the result under that playlist:

- **Working**: "Connected in 0.8 s", plus the account status and expiry date for Xtream playlists ("Active, expires Mar 3, 2027"). For M3U links, it shows how many channels were found.
- **Not working**: a plain reason, for example "No internet connection", "The provider didn't answer within 15 seconds", "Login details were rejected", "Account expired" or "The provider refused this device".
- While it runs, the button shows a spinner and "Testing…". On a Fire Stick the test can be stopped with Back.

The test uses the same connection as playback. On a Fire Stick, that means the Fire Stick's own internet (VPN included), so a provider blocking the device shows up here.

Nothing is saved or changed by a test. The playlist stays as it is.

## Fire TV
The Test button sits in the same row as the other buttons and is reachable with left and right. The result appears under the row without moving focus.

## Technical details
- `iptv-provider.ts`: add `testConnection(playlist)`. It checks `navigator.onLine` first. Xtream calls `verifyXtream` and reports status/expiry. M3U downloads the list and counts entries. The whole test has a 15 s limit (`AbortController`) and measures how long it took. Errors map to the messages above (`describeProviderStatus` is reused).
- `device-provider.ts`: add a `useTestConnection()` hook that runs on the device when the Fire TV bridge is present, and on the server otherwise (same pattern as the existing hooks; the server function goes in `iptv.functions.ts`).
- `playlists.tsx`: add the Test button (`data-pl-col` index after Use, shifting Edit/Delete) and a per-row result line using the existing success and failure icons.
- Website-only change; works on Fire Sticks once the site is published, with no app update needed.
