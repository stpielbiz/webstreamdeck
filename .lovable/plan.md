# Top 10 on Netflix and Prime (only titles you have)

## What the user will get
- In Movies and Shows, two new rows/categories under "Popular now": **Top 10 on Netflix** and **Top 10 on Prime Video**.
- Each shows only the titles from today's top 10 that exist in the user's own playlist, keeping the chart rank (e.g. "#3"). Titles not in the playlist are hidden; if none match, the row is hidden.
- The charts refresh once a day, so they stay current without slowing anything down.
- Same remote navigation as the Popular row; OK opens the usual details window.

## Data sources
- Netflix: Netflix's official public Top 10 list (movies and shows separately, updated weekly by Netflix).
- Prime Video: no official list exists, so it uses a public daily chart site (FlixPatrol). If that site changes or blocks us, the Prime row simply disappears instead of breaking.

## Technical details
- New table `streaming_top10` (service, kind movie/series, rank, title, year, fetched_on), readable by signed-in users, written only by the server. GRANTs + RLS in the migration.
- Server function `getStreamingTop10` (auth): returns cached rows; if older than 24h, refreshes in the handler via fetch (Netflix TSV `top10.netflix.com/data/all-weeks-global.tsv`, latest week, English titles; FlixPatrol Prime page parsed with a light HTML scrape), saved with the admin client. Failures keep the last good data.
- Matching in the browser against the loaded catalogue: normalise titles (lowercase, strip punctuation, year/quality/language tags like "4K", "FR", "(2024)", "S01"), match exactly, then use year as a tiebreak.
- `catalog-workspace.tsx`: render two `PopularRow`-style shelves under Popular, with rank badges, plus category-rail buttons "Top 10 Netflix"/"Top 10 Prime" that scroll to them.
