import type { EpisodeItem } from "./iptv-types";

type Seasons = { season: number; episodes: EpisodeItem[] }[];

/** The episode after `current`: next in its season, else the first of the next season. */
export function nextEpisode(seasons: Seasons, current: { id: string } | null | undefined) {
  if (!current) return undefined;
  for (let s = 0; s < seasons.length; s += 1) {
    const list = seasons[s]!.episodes;
    const i = list.findIndex((episode) => episode.id === current.id);
    if (i < 0) continue;
    if (list[i + 1]) return { episode: list[i + 1]!, index: s };
    for (let n = s + 1; n < seasons.length; n += 1) {
      const first = seasons[n]!.episodes[0];
      if (first) return { episode: first, index: n };
    }
    return undefined;
  }
  return undefined;
}

interface ResumeLike {
  itemKind: string;
  itemId: string;
  seriesId: string | null;
  completed: boolean;
  positionSeconds: number;
  external: boolean;
  updatedAt: string;
}

/**
 * Continue Watching rows: unfinished titles plus, for shows whose latest
 * watched episode is finished, an "up next" entry pointing at that episode
 * (the player starts the one after it). Input order is kept.
 */
export function withUpNext<T extends ResumeLike>(rows: T[]): (T & { upNext?: boolean })[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (row.itemKind !== "episode" || !row.seriesId) continue;
    const prev = latest.get(row.seriesId);
    if (!prev || row.updatedAt > prev.updatedAt) latest.set(row.seriesId, row);
  }
  const out: (T & { upNext?: boolean })[] = [];
  const shown = new Set<string>();
  for (const row of rows) {
    const isEpisode = row.itemKind === "episode" && row.seriesId;
    if (!row.completed && (row.positionSeconds > 30 || row.external)) {
      if (isEpisode) {
        if (shown.has(row.seriesId!)) continue;
        shown.add(row.seriesId!);
      }
      out.push(row);
    } else if (isEpisode && row.completed && latest.get(row.seriesId!) === row && !shown.has(row.seriesId!)) {
      shown.add(row.seriesId!);
      out.push({ ...row, upNext: true, positionSeconds: 0 });
    }
  }
  return out;
}
