# Automatic Xtream conversion for M3U links

## What the user sees
- When someone pastes an M3U link that is really an Xtream login (looks like `http://server/get.php?username=…&password=…`), a green note appears under the field: "This link is an Xtream Codes login — it loads faster that way." with a **Use Xtream Codes** button (on by default when saving).
- Pressing Connect saves it as Xtream Codes (server, username, password filled from the link), so channels, movies and shows load in pieces like TiviMate, instead of one huge download.
- Links that aren't Xtream-style stay as plain M3U, unchanged.
- Editing an existing M3U source that matches also shows the note, so existing users (like the Shark1 playlist) can switch with one press.
- Works the same on PC and Fire Stick (button reachable with the remote).

## Technical details
- New `src/lib/m3u-xtream.ts`: `parseXtreamFromM3u(url)` returns `{ serverUrl, username, password }` when the path ends in `get.php` (also `/playlist/<user>/<pass>` style) with username+password params; keeps scheme, host and port; strips the path.
- `playlists.tsx`: on M3U link change, run the parser; show the note; on Connect (if converting) switch `kind` to `xtream` and submit server/username/password with the M3U name. Edit flow converts the existing source in place.
- Unit tests for the parser: get.php with port, https, missing password (no match), playlist path form, non-Xtream URL (no match).
