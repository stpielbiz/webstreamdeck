# Simpler Playlists screen that works with the remote

## Why it's hard today
Only the Back button on the Playlists screen can be reached with the remote. The tabs, text boxes, Add button and the Use/Delete buttons can't, and the add form always sits on top of your list.

## New flow (one step per screen, every control remote-friendly)
```text
Your playlists  ->  Add a source  ->  Choose type  ->  Enter details  ->  Connecting...  ->  Result
                                     (Xtream / M3U)
```
1. **Your playlists** (start screen): each saved playlist is a card showing its name, type and server, with an "In use" badge on the current one. Each card has **Use**, **Edit** and **Delete** buttons. Below the list sits a big **Add a source** button. If there are no playlists yet, only that button shows, with a short explanation.
2. **Choose type:** two large cards. **Xtream Codes** asks for a server address, username and password. **M3U link** asks for one playlist link.
3. **Enter details:** only the fields for that type, each reachable with Up/Down. Then **Connect** and **Cancel**.
4. **Connecting:** a spinner with "Connecting to your provider…".
5. **Result:**
   - Success: a green check, "Connected to *name*", and what was found (for example "412 channel categories, 9,850 movies, 1,200 shows" for Xtream, or the channel count for M3U). Then a **Done** button that makes it the playlist in use and returns to the list.
   - Failure: a red message in plain words (wrong username/password, server not reachable, not an M3U link), with **Try again** (goes back to the details with everything still filled in) and **Cancel**.
6. **Edit:** opens the same details screen, pre-filled; the password is left blank to keep the current one. Saving re-checks the connection the same way, with the same success or failure screen.
7. **Delete:** asks "Delete *name*? Its favourites and watch history on this playlist will be removed." with **Delete** and **Cancel**.
- Remote **Back** goes back one step (Result -> Details -> Choose type -> List), then to TV Home.

## Technical details
- `iptv.functions.ts`: `createPlaylist` returns `{ playlist, summary }`, where the summary comes from a light probe (Xtream: category counts for live/vod/series; M3U: count of `#EXTINF` in the fetched sample/full text). Add `updatePlaylist` (auth middleware, zod schema, RLS update; blank password keeps the existing one; same verification before saving).
- `playlists.tsx`: rewritten as a small step state machine (`list | type | details | testing | result | confirmDelete`). All buttons, inputs and cards get `data-tv-focus`; the first control of each step gets `data-zone-entry` and is focused on step change. `data-layer-back` on the step-back button, so native Back goes back one step.
- On success: `setActiveId`, `refetch`, and `requestLibraryRefresh` for edited playlists so saved lists reload.
