# Voice button first + list-style search results + show details screen

## 1. Voice search button first (option 1)
- In every search bar (Home, Movies, Shows, Live TV), a large, clearly labelled mic button ("Speak") sits first, to the left of the text box.
- Moving into the search area lands on the mic button first, so pressing OK starts voice search right away. Pressing Right reaches the text box for typing.
- The spoken words fill the search box and the results appear straight away. Focus moves to the first result.
- The mic only shows when voice search is available (the newest Fire TV app or Chrome on a computer). Otherwise the bar looks the way it does now.

## 2. Home search results as a list
- After a search, results show as a vertical list in three groups, in this order: **Shows**, **Movies**, **Channels**. Each group has a heading and a count.
- Each row shows a small image (hidden if it's broken), the name, and the year or channel number when there is one. Beside them are two buttons:
  - **Play**: a channel starts in Live TV, and a movie starts playing. A show opens its details screen, since an episode has to be picked first.
  - **Favourite**: a star that adds or removes the title from favourites. It fills in when the title is a favourite.
- Remote: Up and Down move between rows, Left and Right move between the row, Play and Favourite. Back returns to the search box.
- Up to 30 results per group, with "No matches" when a group is empty.

## 3. Show details screen (no preview)
- Selecting a show from the search results (the name or Play) opens a new full screen, with no video preview. It shows:
  - Poster, title, year, genres, rating and the full description, plus a Favourite button.
  - Season tabs across the top. The episode list for the chosen season shows episode number, title, length and a short description, with a progress bar if the episode was partly watched.
- OK on an episode starts it in the player. When playback stops, Back returns to the same episode. Back on the details screen returns to the search results with the search still filled in.

## Technical details
- Rework the `VoiceButton` to a larger version with a text label. Render it before the input in `global-search.tsx`, `catalog-workspace.tsx` and `tv.live.tsx`, with `data-zone-entry` on the mic where it's the entry point.
- Rewrite the result rendering in `global-search.tsx` as a grouped list. Reuse `useFavorites` and `useToggleFavorite` from `library-hooks.ts`. Movie Play goes to `/tv/watch/movie/$id`, channel Play goes to `/tv/live?channel=`.
- Add a new route `src/routes/_authenticated/tv.show.$id.tsx` that uses `getSeries` for info, seasons and episodes. It plays through the existing native/`VideoPlayer` path the same way `tv.watch.series.$id.tsx` does, with no preview player on screen. Its `from` search param handles returning home.
- Keep the home search query in the URL search params (`q`) so Back from the details screen brings the results back.
- Native app: no changes needed.
