# Smooth Live TV scrolling while the guide fills in

## Goal
Channels can always be scrolled, even when "what's playing" isn't loaded yet. Programme details appear as they arrive, future programmes are kept on the device, and finished ones are removed.

## What happens today
- Each time the list grows by 40, the app asks the provider for every channel on screen without a saved guide as one big request, and starts a fresh request whenever the list changes.
- When the answer comes back, every channel's schedule is rebuilt at once. On a Fire Stick this blocks the remote for a moment, so scrolling looks frozen.

## Changes
1. **Fetch only near where you are.** Ask for schedules in small batches (about 10 channels) around the focused channel, nearest first, then the next few below. Channels already requested are never asked for again, even while you keep scrolling.
2. **Never block the remote.** Wait for a short pause in key presses (and use the existing idle gate) before sending or applying a batch. Rows show a light "Loading guide…" placeholder until their details arrive.
3. **Update row by row.** New details are added only for the channels in that batch. Other rows aren't redrawn.
4. **Save the future, drop the past.** Each fetch asks for as much upcoming schedule as the provider gives (up to about 2 days). Saved programmes that have already ended are deleted. A channel is only refetched when it has less than about 3 hours of programmes left, not on a fixed timer.
5. **Keep it on the device.** Saved schedules use the existing device storage, so going back to a category shows the guide straight away.

## How to check
Open a big category on the Fire Stick and hold Down. Focus should keep moving without pauses, and programme names should appear shortly after you stop.

## Technical details
- `tv.live.tsx`: replace the single `useQuery` keyed on all uncovered IDs with a small batch queue (ref-held `requested` Set, debounced ~250 ms after last key, `waitForIdle` from background-gate, batches of 10 ordered by distance from `focusedId`, one in flight).
- Memoize normalized schedules per channel (cache by channel + `at`) so `scheduleMap` doesn't renormalize every channel on each merge.
- `library-sync.ts` `mergeGuide`: keep pruning ended programmes; extend fetch span to ~48 h; replace the `GUIDE_TTL` staleness check with "last programme ends within 3 h".
- Row component wrapped in `memo` so unchanged rows skip rerender.
