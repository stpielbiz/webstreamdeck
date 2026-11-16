# Home: collapsible favourite cards

## What changes
- On Home (TV and website), the favourites area becomes three stacked cards: **Favourite channels**, **Favourite movies**, **Favourite shows**. Each shows its count and is collapsed by default.
- OK/click on a card opens it and shows the list; OK again closes it. Several can be open at once. Opening a card leaves focus on it, and pressing Down moves into the list.
- Nothing inside a card is built while it's closed: no rows, logos, poster pictures or matching against other playlists. That work happens only when the card is opened.
- The Favourites page itself stays as it is now (three lists, always open).

## Remote behaviour (TV)
- Up/Down moves between the three card headers when they're closed. When a card is open, Down from its header goes into its rows, and Down from the last row goes to the next card.
- Back from inside a list returns to that card's header. Hold OK to remove still works on rows.

## Technical details
- `src/components/favourites-lists.tsx`: when `home` is set, render a `HomeFavouriteCards` variant. Each group is a button header (`data-tv-focus`, `aria-expanded`) with local open state; rows render, and the cross-playlist matching runs, only for open groups. Counts come from the already-cached favourites list Home loads for its own counts, so no extra request is made.
- Home's custom column arrow handling is replaced by a single vertical order: header → rows → next header.
- The non-home layout is unchanged.
- Check with a browser run on the TV home: cards closed, open Movies, arrow into the rows and back out, then confirm no poster images were requested before opening.
