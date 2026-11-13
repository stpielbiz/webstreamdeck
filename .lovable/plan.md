# Next episode button and "Up next" on Home

## 1. Make the Next button work while a show plays (Fire TV)
The Fire TV player uses the standard on-screen controls, which always draw a Next button. The app only gives the player one episode at a time, so that button is always greyed out.

- When an episode is opened, the app also tells the player the title of the next episode (same season, or first episode of the next season).
- The Next button becomes active when there is a next episode. Pressing it saves the current spot, marks the current episode as watched, and starts the next one right away.
- On the last episode of the show, Next stays hidden.
- Movies and live channels: Next and Previous buttons are hidden instead of greyed out.
- When an episode reaches its end, the next one starts automatically (with a short "Up next" note), instead of closing the player.

On the website player, the existing "Next episode" button keeps working; it will also be hidden on the last episode.

## 2. Show the next episode on Home when one finishes
Today a finished episode disappears from Continue Watching. Instead:
- When the latest episode watched for a show is finished, Home shows that show's next episode as "Up next · S1 E2", starting from the beginning.
- Selecting it plays that exact episode directly (same as other Continue Watching tiles).
- When the last episode of the show is finished, the show leaves Home as it does now.
- Removing the tile from Home works as it does today.

## Technical details
- `PlayerActivity.kt`: accept `EXTRA_HAS_NEXT` / next title; use a custom `ForwardingPlayer` (or `playerView.setShowNextButton/ShowPreviousButton`) so Next is enabled only when a next episode exists; on Next or STATE_ENDED, call a new bridge callback `__streamDeckNext()` instead of finishing, and keep the activity open for the next URL (new `loadNext(url, title, startPosition)` via the JS bridge). Fallback: older apps keep current behaviour.
- `external-player.ts` / `video-player.tsx`: pass `hasNext` + `onNext` through `playNative`; `series.$id.tsx` supplies them from its existing `playNext` logic (extracted into a shared `nextEpisode(seasons, current)` helper with tests).
- Home (`tv.index.tsx`, `dashboard.tsx`): for each series whose most recent episode row is `completed`, derive an "up next" row from the cached series episode list (fetched lazily, cached on-device) and link with episode ID + season/episode, resolved via `selectResumeEpisode`.
- Tests: `nextEpisode` across season boundary and last episode; Home up-next derivation.
- The Fire TV part needs a new Fire TV app release; the Home part works after publishing the site.
