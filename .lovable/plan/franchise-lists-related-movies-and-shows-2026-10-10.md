# Franchise lists: related movies and shows

## Goal
When a search matches a title that belongs to a franchise, such as Yellowstone, Captain America or Star Wars, show a **franchise card** that opens a list of every related title in the user's playlist. The list can be sorted by **release year** or by **story order**.

## What the user will see
- **Search:** above the normal results there is a card, for example "Yellowstone universe: 4 titles in your library". It can be reached with the remote and opened with OK.
- **Franchise list:** a list of every title in the franchise.
  - Titles in the user's playlist can be played; selecting one opens the usual details window with its link choices.
  - Titles the user doesn't have appear greyed out with the note "Not in your list", the same way Top 10 handles them.
  - A sort switch offers **By year** (the default) and **Story order**. Story order is only offered when the franchise has one, such as Star Wars, the Marvel films or Yellowstone with 1883 and 1923.
- **Title details:** the details window gets a "Part of the Star Wars saga" button that opens the same list.
- Remote: Up/Down moves through the list, Left/Right changes the sort, and Back closes the list and returns to search.

## How franchises are found
1. **The movie database's collections** (for example "Captain America Collection") are used for movies when available. These are reliable and already ordered by year.
2. **AI fills the gaps:** for TV universes (Yellowstone with 1883, 1923 and the 1944 spin-off) and for story order, it returns the franchise name, its members with their years, and the story order.
3. **Each franchise is saved permanently in a shared store.** Every franchise is looked up once and then reused by every user, the same way title details already work.
4. Franchise members are matched to the user's catalogue with the existing title matching, so quality variants are grouped together.

## Technical details
- New table `franchises`: id, name, kind (movie/series/mixed), `members` jsonb holding title, year, kind and story_index, plus source, created_at and updated_at. It also gets a lookup table `franchise_titles`: normalised title key mapped to franchise_id. Both have a signed-in SELECT policy, writes happen only from the server, and both get grants plus RLS.
- New server function `resolveFranchise({ title, kind })` in `src/lib/franchise.functions.ts`, protected with `requireSupabaseAuth`:
  1. It checks `franchise_titles` first.
  2. If nothing is found, it checks TMDB `belongs_to_collection` (reusing the existing metadata lookup), then asks the Lovable AI Gateway for structured JSON. That JSON contains the name and the members with year and story_index.
  3. It saves the result with the admin client and also records a "no franchise" result, so the same title is not asked about again.
- `global-search.tsx`: after the query settles, it resolves the franchise of the top match (debounced) and renders a `FranchiseCard` at the start of the results.
- New `FranchiseList` overlay component (layer-aware Back, `data-tv-focus`) that reuses `groupCatalogItems` and `mediaMatchKey` to map members to the user's catalogue groups. It opens `TitleDetailsDialog` with the matching variants.
- `title-details-dialog.tsx`: adds the optional "Part of …" button when the title is in a franchise.
- Record the rule in AGENTS.md: franchises are resolved once, stored in the shared tables, and matched to catalogues on the device.

## Verification
- Search for Yellowstone, Captain America and Star Wars. Check that the card appears, that both sorts order the titles correctly, and that missing titles are greyed out.
- Check remote navigation and Back behaviour at the Fire TV layout size.
