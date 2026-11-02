import type { EpisodeItem } from "./iptv-types";

/** IDs are playlist-specific; season/episode identify synced episodes. */
export function selectResumeEpisode(
  seasons: { season: number; episodes: EpisodeItem[] }[],
  target: { itemId?: string | undefined; season?: number | null | undefined; episode?: number | null | undefined },
) {
  const all = seasons.flatMap((season, index) => season.episodes.map((episode) => ({ episode, index })));
  return all.find((entry) => entry.episode.id === target.itemId)
    ?? (target.season != null && target.episode != null
      ? all.find((entry) => entry.episode.season === target.season && entry.episode.episode === target.episode)
      : undefined);
}