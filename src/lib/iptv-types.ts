export type PlaylistKind = "xtream" | "m3u";
export type CatalogKind = "live" | "movie" | "series";
export type ItemKind = "live" | "movie" | "series" | "episode";

export interface Category {
  id: string;
  name: string;
  count?: number;
}

export interface CatalogItem {
  /** Stable id used for playback, favourites and progress. */
  id: string;
  name: string;
  image: string | null;
  categoryId: string | null;
  /** Live channel number, when the provider supplies one. */
  number?: number | null;
  rating?: string | null;
  year?: string | null;
  /** Container extension for VOD playback (mp4/mkv). */
  ext?: string | null;
  /** EPG channel id, live only. */
  epgId?: string | null;
}

export interface MovieDetails extends CatalogItem {
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null;
  durationSeconds: number | null;
  backdrop: string | null;
}

export interface EpisodeItem {
  id: string;
  title: string;
  season: number;
  episode: number;
  plot: string | null;
  image: string | null;
  ext: string | null;
  durationSeconds: number | null;
}

export interface SeriesDetails extends CatalogItem {
  plot: string | null;
  cast: string | null;
  genre: string | null;
  backdrop: string | null;
  seasons: { season: number; episodes: EpisodeItem[] }[];
}

export interface Programme {
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
}

export interface NowNext {
  channelId: string;
  now: Programme | null;
  next: Programme | null;
}
