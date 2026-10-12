# Favourite channels start playing when clicked

## Problem

Clicking (or pressing OK on) a channel in the Favourites list only opens the Live TV screen — the channel never starts streaming. The user must find the channel and press OK again.

## Cause

- Favourites (`src/components/favourites-lists.tsx`) navigates to `/tv/live?channel=<id>` (or `/live?channel=<id>` on the web).
- On the Fire TV guide (`src/routes/_authenticated/tv.live.tsx`), the `channel` parameter only moves the guide to the right page and focuses the channel row (lines 187–193). Playback only starts when OK is pressed on a channel, so nothing plays.
- On the web Live TV page (`src/routes/_authenticated/live.tsx`), the parameter selects the channel, which starts the small preview player — but not the main viewing experience.

## Changes

### Fire TV guide (`src/routes/_authenticated/tv.live.tsx`)

- When the `channel` search parameter matches a channel, select it and open the full-screen player immediately (same path as pressing OK twice on a channel), in addition to paging/focusing the row.
- Back from the player returns to the guide with that channel focused (existing restore-focus behavior).
- Clear the `channel` parameter after consuming it so a later Back or refresh doesn't unexpectedly restart playback.

### Web Live TV (`src/routes/_authenticated/live.tsx`)

- The `channel` parameter already selects the channel and starts the preview player. Verify this works end-to-end; if the preview doesn't autoplay reliably, start playback explicitly when the parameter is consumed.

## Verification

- Build passes.
- Preview check: from Favourites, click a channel and confirm the stream starts without a second press, on both the TV guide and the web Live TV page.
