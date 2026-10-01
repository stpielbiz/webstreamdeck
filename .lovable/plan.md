# Mark titles watched in an external player

## Goal
When a movie or episode is handed to VLC / an external player, Stream Deck can't track the position — but it should still remember that you started watching it. The title appears in "Continue watching" with an external-player badge instead of a progress bar.

## Changes

### 1. Database — new `external` flag on watch history
- Migration: add an `external boolean not null default false` column to `watch_progress`.
- `saveProgress` in `src/lib/iptv.functions.ts` accepts an optional `external: true` flag and stores it; `listProgress` / `ProgressRow` return it.

### 2. Record the hand-off — `src/components/video-player.tsx`
- New optional prop `onExternalLaunch?: () => void`.
- Fired once per stream when the player auto-launches the external player (the existing auto-launch effect), and also when the viewer clicks a "Play in VLC / MX Player" button or the VLC button in the controls.

### 3. Save from the watch pages
- `tv.watch.movie.$id.tsx` and `tv.watch.series.$id.tsx`: pass `onExternalLaunch` to `VideoPlayer`, calling `saveProgress` with `external: true`, `positionSeconds: 0` and no duration. This creates/updates the history row the moment the stream leaves the browser, without touching any real resume position already saved (the upsert keeps the existing position when the new one is 0 and external is set).

### 4. Show the badge — `src/components/media.tsx` + `dashboard.tsx`
- `PosterTile` gets an optional `external` prop: an ExternalLink icon chip in the top-left corner of the poster and the subtitle "Watching in VLC" (no progress bar).
- The dashboard "Continue watching" shelf includes rows marked external (even with no saved position) and passes the badge through.

## Technical notes
- No RLS changes: the column lives on the existing `watch_progress` table, policies unchanged.
- Live TV channels are not affected (no watch history for live).
- Verified with a typecheck, clean build, and a quick browser check that an external hand-off makes the title appear in Continue watching with the badge.
