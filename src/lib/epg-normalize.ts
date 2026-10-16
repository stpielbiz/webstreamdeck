import type { Programme } from "./iptv-types";

/**
 * Providers sometimes send overlapping or duplicate listings for a channel
 * (e.g. a long game plus the show that replaced it). Keep one listing per
 * moment: the newer entry wins from its start, the older one is clipped.
 */
export function normalizeSchedule<T extends Pick<Programme, "start" | "end" | "title">>(programmes: T[]): T[] {
  const sorted = programmes
    .map((p) => ({ p, s: Date.parse(p.start ?? ""), e: Date.parse(p.end ?? "") }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > x.s)
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out: { p: T; s: number; e: number }[] = [];
  for (const item of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.s === item.s) {
      // Same start: keep the first (longest) one, drop the duplicate.
      continue;
    }
    if (prev && item.s < prev.e) {
      prev.e = item.s;
      prev.p = { ...prev.p, end: new Date(item.s).toISOString() };
    }
    out.push({ ...item });
  }
  return out.filter((x) => x.e > x.s).map((x) => x.p);
}
