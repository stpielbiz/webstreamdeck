# Explain the benefits of the movie/show details update

## Goal

When a user has never completed a "download details" update for movies or shows, the app should explain why it's worth doing — on the Home screen and inside movie/show details — so users know to run it from Settings.

## How we know an update hasn't run

`src/lib/library-sync.tsx` already records a per-device "details done" count in localStorage (`sd-details-done:<playlist>:<kind>`) when a full details update finishes. A new exported helper `hasCompletedDetailsUpdate(playlistId, kind)` will compare that count against the catalogue size.

## Changes

### 1. Shared hint component (new `src/components/details-update-hint.tsx`)

A small, dismissible-looking info panel (not actually dismissible — it disappears once an update completes) with:

- A short headline: "Get more from your movies and shows"
- The benefits in plain words: posters and artwork, full descriptions, actors, genres and years, search that also matches actors, franchise/collection lists, and better "Popular on Stream Deck" rows
- Where to do it: a button linking to Settings ("Update details now" lives there); on TV it links to the TV-mode Settings
- A note that the update runs in the background and they should wait until it finishes

### 2. TV home (`src/routes/_authenticated/tv.index.tsx`)

In `LibraryStatus`, when the section is Movies or Shows and the details update has never completed for the active playlist, render the hint under the status block.

### 3. Web home (`src/routes/_authenticated/dashboard.tsx`)

Above the favourites lists, show the same hint when either movies or shows have never completed a details update.

### 4. Movie/show details window (`src/components/title-details-dialog.tsx`)

When the opened title has no saved details (no description and no cast) and the details update hasn't completed for that kind, show a one-line note under the title area: "No details saved yet — run the movie & show details update in Settings to see descriptions, artwork, actors and more." Titles that simply have no information anywhere stay quiet once an update has completed.

## Verification

- Build passes.
- Preview check: with a playlist that has never run the update, the hint appears on Home and in a details window; after running the update to completion, the hint disappears.
