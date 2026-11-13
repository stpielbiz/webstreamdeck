/** Listed show on a channel, times in ms. */
export interface ShowSlot {
  title: string;
  start: number;
  end: number;
}

const EARLY_MS = 60_000;
const LATE_MS = 2 * 60_000;

/** Recording times for one show: 1 min early, 2 min late; a show already on starts now. */
export function showWindow(show: ShowSlot, now: number): { start: number; end: number } {
  return { start: Math.max(now, show.start - EARLY_MS), end: show.end + LATE_MS };
}

/** Start of the first listed show after `after`, or null. */
export function nextShowStart(shows: ShowSlot[], after: number): number | null {
  const hit = shows.filter((s) => s.start > after).sort((a, b) => a.start - b.start)[0];
  return hit ? hit.start : null;
}

/** Start of the last listed show before `before` but not before `earliest`, or null. */
export function previousShowStart(shows: ShowSlot[], before: number, earliest: number): number | null {
  const hit = shows.filter((s) => s.start < before && s.start >= earliest).sort((a, b) => b.start - a.start)[0];
  return hit ? hit.start : null;
}

/** Default start for "Later": the next show (5+ min away), else an hour from now on the quarter hour. */
export function defaultLaterStart(shows: ShowSlot[], now: number): number {
  return nextShowStart(shows, now + 5 * 60_000) ?? Math.ceil((now + 60 * 60_000) / (15 * 60_000)) * 15 * 60_000;
}
