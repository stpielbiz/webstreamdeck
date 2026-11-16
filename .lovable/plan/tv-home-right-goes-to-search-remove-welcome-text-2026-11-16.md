# TV Home: Right goes to search, remove welcome text

## What changes
1. From the Home menu, pressing Right lands on the search bar at the top of the home content (instead of the first Continue Watching tile). Pressing Down from search moves into Continue Watching and the other rows as today.
2. Remove the "Your library / Welcome back / Pick up where you stopped…" block so the rows move up.

## Technical details
- `src/routes/_authenticated/tv.index.tsx`: Continue Watching's first tile is marked `zoneEntry`, so it wins the Right handoff. Mark the GlobalSearch field as the zone entry (wrapper/input gets the entry attribute) and only fall back to the first tile when search isn't shown (no playlist / expired).
- Delete the welcome heading block (lines ~133–137).
- Check with a browser run on the TV home: focus Home, press Right, confirm the search field is focused; press Down, confirm the first Continue Watching tile.
