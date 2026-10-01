# Category list first + "Top 10 watched now"

## 1. Show all categories right away
On the TV Movies and Shows screens the category list never loads at the first level (it only loads after a category is already chosen), so only "All movies"/"All shows" appears. Fix:
- Load categories as soon as the Movies/Shows screen opens, and stop loading the full catalogue until a category is picked.
- Show the full list of categories immediately; keep "All movies"/"All shows" as the last option instead of the first so it's not the default pick.
- Remote focus starts on the first real category.
- Same check on the regular (desktop/phone) Movies and Shows pages: categories first, "Everything" moved to the end.

## 2. Top 10 "Popular now" row
At the top of the Movies and Shows category list, show a horizontal row of the 10 most-watched titles across all Stream Deck users in the last 7 days, numbered 1–10 with posters.
- Counted per unique viewer (one person replaying doesn't inflate it), including external-player (VLC) launches.
- Titles are matched by name, since each user's provider uses different IDs. Selecting a tile searches the user's own playlist for that title and plays it (movie) or opens it (show); if not found, a short "Not in your playlist" message.
- Only titles/posters and counts are shared — never who watched what.
- Row hidden if fewer than 3 titles qualify.

## Technical details
- Bug: `tv.movies.tsx` / `tv.series.tsx` have `enabled: categoryId !== null` on the categories query and `enabled: !!activeId` on items — swap these.
- New security-definer SQL function `popular_titles(kind item_kind, days int default 7, lim int default 10)` grouping `watch_progress` by normalized title, `count(distinct user_id)`, returning title, any poster_url, viewer count; grant execute to authenticated. No new table.
- Server fn `getPopular` (requireSupabaseAuth) + shared `PopularRow` component used in TV and regular catalog screens; tile resolves via existing `getItems` search.
