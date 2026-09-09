/**
 * Provider layer: talks to Xtream Codes servers and parses M3U playlists,
 * normalising both into the shared shapes in iptv-types.ts.
 * Server-only — never import this from a component.
 */
import type {
  Category,
  CatalogItem,
  CatalogKind,
  EpisodeItem,
  MovieDetails,
  NowNext,
  Programme,
  SeriesDetails,
} from "./iptv-types";

export interface PlaylistRow {
  id: string;
  name: string;
  kind: "xtream" | "m3u";
  server_url: string | null;
  username: string | null;
  password: string | null;
  m3u_url: string | null;
}

const USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";

export function providerFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  headers.set("accept", headers.get("accept") ?? "*/*");
  return fetch(url, { ...init, headers, redirect: "follow" });
}

export function normalizeBase(serverUrl: string): string {
  let base = serverUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base.replace(/\/player_api\.php.*$/i, "");
}

/* ------------------------------------------------------------------ Xtream */

async function xtream(playlist: PlaylistRow, params: Record<string, string>) {
  if (!playlist.server_url || !playlist.username || !playlist.password) {
    throw new Error("This playlist is missing its server details.");
  }
  const url = new URL(`${normalizeBase(playlist.server_url)}/player_api.php`);
  url.searchParams.set("username", playlist.username);
  url.searchParams.set("password", playlist.password);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await providerFetch(url.toString());
  if (!response.ok) {
    throw new Error(`The provider returned an error (${response.status}).`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The provider did not return a valid response.");
  }
}

export async function verifyXtream(playlist: PlaylistRow) {
  const data = (await xtream(playlist, {})) as {
    user_info?: { auth?: number; status?: string; exp_date?: string | null };
  };
  if (!data?.user_info || data.user_info.auth === 0) {
    throw new Error("Those login details were rejected by the provider.");
  }
  return {
    status: data.user_info.status ?? "Active",
    expiresAt: data.user_info.exp_date ?? null,
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

const str = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);

const XTREAM_ACTIONS: Record<CatalogKind, { categories: string; items: string }> = {
  live: { categories: "get_live_categories", items: "get_live_streams" },
  movie: { categories: "get_vod_categories", items: "get_vod_streams" },
  series: { categories: "get_series_categories", items: "get_series" },
};

async function xtreamCategories(playlist: PlaylistRow, kind: CatalogKind): Promise<Category[]> {
  const rows = asArray(await xtream(playlist, { action: XTREAM_ACTIONS[kind].categories }));
  return rows.map((row) => ({
    id: String(row["category_id"]),
    name: str(row["category_name"]) ?? "Unnamed",
  }));
}

async function xtreamItems(
  playlist: PlaylistRow,
  kind: CatalogKind,
  categoryId?: string,
): Promise<CatalogItem[]> {
  const params: Record<string, string> = { action: XTREAM_ACTIONS[kind].items };
  if (categoryId) params["category_id"] = categoryId;
  const rows = asArray(await xtream(playlist, params));

  return rows.map((row) => {
    const id = String(row[kind === "series" ? "series_id" : "stream_id"] ?? row["num"] ?? "");
    return {
      id,
      name: str(row["name"]) ?? str(row["title"]) ?? "Untitled",
      image: str(row["stream_icon"]) ?? str(row["cover"]) ?? null,
      categoryId: str(row["category_id"]),
      number: typeof row["num"] === "number" ? (row["num"] as number) : null,
      rating: str(row["rating"]),
      year: str(row["year"]) ?? str(row["releaseDate"]),
      ext: str(row["container_extension"]),
      epgId: str(row["epg_channel_id"]),
    } satisfies CatalogItem;
  });
}

function seconds(value: unknown): number | null {
  const raw = str(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function xtreamMovie(playlist: PlaylistRow, id: string): Promise<MovieDetails> {
  const data = (await xtream(playlist, { action: "get_vod_info", vod_id: id })) as {
    info?: Record<string, unknown>;
    movie_data?: Record<string, unknown>;
  };
  const info = data.info ?? {};
  const movie = data.movie_data ?? {};
  return {
    id,
    name: str(movie["name"]) ?? str(info["name"]) ?? "Untitled",
    image: str(info["movie_image"]) ?? str(info["cover_big"]),
    backdrop: Array.isArray(info["backdrop_path"]) ? str(info["backdrop_path"][0]) : null,
    categoryId: str(movie["category_id"]),
    plot: str(info["plot"]) ?? str(info["description"]),
    cast: str(info["cast"]) ?? str(info["actors"]),
    director: str(info["director"]),
    genre: str(info["genre"]),
    rating: str(info["rating"]),
    year: str(info["releasedate"]) ?? str(info["release_date"]),
    ext: str(movie["container_extension"]) ?? "mp4",
    durationSeconds: seconds(info["duration_secs"] ?? info["duration"]),
  };
}

async function xtreamSeries(playlist: PlaylistRow, id: string): Promise<SeriesDetails> {
  const data = (await xtream(playlist, { action: "get_series_info", series_id: id })) as {
    info?: Record<string, unknown>;
    episodes?: Record<string, unknown>;
  };
  const info = data.info ?? {};
  const seasonMap = (data.episodes ?? {}) as Record<string, unknown>;

  const seasons = Object.entries(seasonMap)
    .map(([seasonKey, rawEpisodes]) => ({
      season: Number(seasonKey) || 0,
      episodes: asArray(rawEpisodes)
        .map((episode) => {
          const epInfo = (episode["info"] ?? {}) as Record<string, unknown>;
          return {
            id: String(episode["id"]),
            title: str(episode["title"]) ?? `Episode ${str(episode["episode_num"]) ?? ""}`.trim(),
            season: Number(episode["season"] ?? seasonKey) || 0,
            episode: Number(episode["episode_num"] ?? 0),
            plot: str(epInfo["plot"]),
            image: str(epInfo["movie_image"]) ?? str(info["cover"]),
            ext: str(episode["container_extension"]) ?? "mp4",
            durationSeconds: seconds(epInfo["duration_secs"] ?? epInfo["duration"]),
          } satisfies EpisodeItem;
        })
        .sort((a, b) => a.episode - b.episode),
    }))
    .sort((a, b) => a.season - b.season);

  return {
    id,
    name: str(info["name"]) ?? "Untitled",
    image: str(info["cover"]),
    backdrop: Array.isArray(info["backdrop_path"]) ? str(info["backdrop_path"][0]) : null,
    categoryId: str(info["category_id"]),
    plot: str(info["plot"]),
    cast: str(info["cast"]),
    genre: str(info["genre"]),
    rating: str(info["rating"]),
    year: str(info["releaseDate"]) ?? str(info["last_modified"]),
    ext: null,
    seasons,
  };
}

function decodeEpgValue(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)!;
    return new TextDecoder().decode(bytes) || null;
  } catch {
    return raw;
  }
}

function toIso(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
  const parsed = new Date(raw.replace(" ", "T") + (/[+-]\d{2}:?\d{2}$/.test(raw) ? "" : "Z"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function xtreamShortEpg(playlist: PlaylistRow, channelId: string): Promise<NowNext> {
  try {
    const data = (await xtream(playlist, {
      action: "get_short_epg",
      stream_id: channelId,
      limit: "4",
    })) as { epg_listings?: unknown };
    const listings = asArray(data.epg_listings).map(
      (row) =>
        ({
          title: decodeEpgValue(row["title"]) ?? "No title",
          description: decodeEpgValue(row["description"]),
          start: toIso(row["start_timestamp"] ?? row["start"]),
          end: toIso(row["stop_timestamp"] ?? row["end"]),
        }) satisfies Programme,
    );
    const now = Date.now();
    const current =
      listings.find((item) => {
        const start = item.start ? Date.parse(item.start) : NaN;
        const end = item.end ? Date.parse(item.end) : NaN;
        return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end >= now;
      }) ?? null;
    const currentIndex = current ? listings.indexOf(current) : -1;
    return {
      channelId,
      now: current ?? listings[0] ?? null,
      next: listings[currentIndex >= 0 ? currentIndex + 1 : 1] ?? null,
    };
  } catch {
    return { channelId, now: null, next: null };
  }
}

export async function xtreamSchedule(
  playlist: PlaylistRow,
  channelId: string,
): Promise<Programme[]> {
  const data = (await xtream(playlist, {
    action: "get_simple_data_table",
    stream_id: channelId,
  })) as { epg_listings?: unknown };
  return asArray(data.epg_listings)
    .map(
      (row) =>
        ({
          title: decodeEpgValue(row["title"]) ?? "No title",
          description: decodeEpgValue(row["description"]),
          start: toIso(row["start_timestamp"] ?? row["start"]),
          end: toIso(row["stop_timestamp"] ?? row["end"]),
        }) satisfies Programme,
    )
    .sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));
}

/* --------------------------------------------------------------------- M3U */

interface M3uEntry {
  name: string;
  logo: string | null;
  group: string;
  tvgId: string | null;
  url: string;
}

export function parseM3u(text: string): M3uEntry[] {
  const entries: M3uEntry[] = [];
  let pending: Omit<M3uEntry, "url"> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toUpperCase().startsWith("#EXTINF")) {
      const attrs: Record<string, string> = {};
      for (const match of line.matchAll(/([a-zA-Z0-9_-]+)="([^"]*)"/g)) {
        attrs[match[1]!.toLowerCase()] = match[2]!;
      }
      const commaIndex = line.lastIndexOf(",");
      const display = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "Untitled";
      pending = {
        name: display || attrs["tvg-name"] || "Untitled",
        logo: attrs["tvg-logo"] ?? attrs["logo"] ?? null,
        group: attrs["group-title"] || "Uncategorised",
        tvgId: attrs["tvg-id"] || null,
      };
    } else if (!line.startsWith("#")) {
      if (pending) entries.push({ ...pending, url: line });
      pending = null;
    }
  }
  return entries;
}

function encodeId(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeId(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)!;
  return new TextDecoder().decode(bytes);
}

const EPISODE_PATTERN = /^(.*?)[\s._-]*[sS](\d{1,2})[\s._-]*[eE](\d{1,3})(.*)$/;

function classify(entry: M3uEntry): CatalogKind {
  const path = entry.url.toLowerCase();
  if (path.includes("/series/")) return "series";
  if (path.includes("/movie/") || path.includes("/vod/")) return "movie";
  if (EPISODE_PATTERN.test(entry.name)) return "series";
  if (/\.(mp4|mkv|avi)(\?|$)/.test(path)) return "movie";
  return "live";
}

interface ParsedPlaylist {
  live: CatalogItem[];
  movie: CatalogItem[];
  series: CatalogItem[];
  episodes: Map<string, EpisodeItem[]>;
  urls: Map<string, string>;
}

const cache = new Map<string, { at: number; value: ParsedPlaylist }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadM3u(playlist: PlaylistRow): Promise<ParsedPlaylist> {
  const cached = cache.get(playlist.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  if (!playlist.m3u_url) throw new Error("This playlist has no link saved.");

  const response = await providerFetch(playlist.m3u_url);
  if (!response.ok) throw new Error(`The playlist link returned an error (${response.status}).`);
  const entries = parseM3u(await response.text());

  const parsed: ParsedPlaylist = {
    live: [],
    movie: [],
    series: [],
    episodes: new Map(),
    urls: new Map(),
  };
  const seriesIndex = new Map<string, CatalogItem>();

  for (const entry of entries) {
    const kind = classify(entry);
    const id = encodeId(entry.url);
    parsed.urls.set(id, entry.url);

    if (kind === "series") {
      const match = EPISODE_PATTERN.exec(entry.name);
      const showName = (match?.[1] ?? entry.name).replace(/[._]/g, " ").trim() || entry.name;
      const seriesId = encodeId(`${entry.group}|${showName}`);
      if (!seriesIndex.has(seriesId)) {
        const item: CatalogItem = {
          id: seriesId,
          name: showName,
          image: entry.logo,
          categoryId: entry.group,
        };
        seriesIndex.set(seriesId, item);
        parsed.series.push(item);
        parsed.episodes.set(seriesId, []);
      }
      parsed.episodes.get(seriesId)!.push({
        id,
        title: match?.[4]?.replace(/^[\s._-]+/, "").trim() || entry.name,
        season: Number(match?.[2] ?? 1),
        episode: Number(match?.[3] ?? parsed.episodes.get(seriesId)!.length + 1),
        plot: null,
        image: entry.logo,
        ext: null,
        durationSeconds: null,
      });
      continue;
    }

    const item: CatalogItem = {
      id,
      name: entry.name,
      image: entry.logo,
      categoryId: entry.group,
      epgId: entry.tvgId,
    };
    if (kind === "movie") parsed.movie.push(item);
    else parsed.live.push(item);
  }

  cache.set(playlist.id, { at: Date.now(), value: parsed });
  return parsed;
}

/* ---------------------------------------------------------- public surface */

export async function fetchCategories(
  playlist: PlaylistRow,
  kind: CatalogKind,
): Promise<Category[]> {
  if (playlist.kind === "xtream") return xtreamCategories(playlist, kind);
  const parsed = await loadM3u(playlist);
  const counts = new Map<string, number>();
  for (const item of parsed[kind]) {
    const key = item.categoryId ?? "Uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchItems(
  playlist: PlaylistRow,
  kind: CatalogKind,
  categoryId?: string,
  search?: string,
): Promise<CatalogItem[]> {
  let items =
    playlist.kind === "xtream"
      ? await xtreamItems(playlist, kind, search ? undefined : categoryId)
      : (await loadM3u(playlist))[kind].filter(
          (item) => !categoryId || item.categoryId === categoryId,
        );

  if (search) {
    const needle = search.toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(needle));
  }
  return items.slice(0, 3000);
}

export async function fetchMovie(playlist: PlaylistRow, id: string): Promise<MovieDetails> {
  if (playlist.kind === "xtream") return xtreamMovie(playlist, id);
  const parsed = await loadM3u(playlist);
  const item = parsed.movie.find((movie) => movie.id === id);
  if (!item) throw new Error("That title is no longer in the playlist.");
  return {
    ...item,
    plot: null,
    cast: null,
    director: null,
    genre: item.categoryId,
    backdrop: null,
    durationSeconds: null,
  };
}

export async function fetchSeries(playlist: PlaylistRow, id: string): Promise<SeriesDetails> {
  if (playlist.kind === "xtream") return xtreamSeries(playlist, id);
  const parsed = await loadM3u(playlist);
  const item = parsed.series.find((series) => series.id === id);
  if (!item) throw new Error("That series is no longer in the playlist.");
  const episodes = parsed.episodes.get(id) ?? [];
  const bySeason = new Map<number, EpisodeItem[]>();
  for (const episode of episodes) {
    if (!bySeason.has(episode.season)) bySeason.set(episode.season, []);
    bySeason.get(episode.season)!.push(episode);
  }
  return {
    ...item,
    plot: null,
    cast: null,
    genre: item.categoryId,
    backdrop: null,
    seasons: [...bySeason.entries()]
      .map(([season, list]) => ({
        season,
        episodes: list.sort((a, b) => a.episode - b.episode),
      }))
      .sort((a, b) => a.season - b.season),
  };
}

export async function fetchNowNext(
  playlist: PlaylistRow,
  channelIds: string[],
): Promise<NowNext[]> {
  if (playlist.kind !== "xtream") {
    return channelIds.map((channelId) => ({ channelId, now: null, next: null }));
  }
  const results: NowNext[] = [];
  const queue = channelIds.slice(0, 60);
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      const channelId = queue.shift();
      if (!channelId) return;
      results.push(await xtreamShortEpg(playlist, channelId));
    }
  });
  await Promise.all(workers);
  return results;
}

/** Resolve the upstream media URL for an item. */
export async function resolveStreamUrl(
  playlist: PlaylistRow,
  kind: "live" | "movie" | "episode",
  itemId: string,
  ext?: string | null,
): Promise<string> {
  if (playlist.kind === "m3u") {
    const parsed = await loadM3u(playlist);
    const url = parsed.urls.get(itemId);
    if (url) return url;
    try {
      const decoded = decodeId(itemId);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      /* fall through */
    }
    throw new Error("That item is no longer in the playlist.");
  }

  const base = normalizeBase(playlist.server_url ?? "");
  const auth = `${encodeURIComponent(playlist.username ?? "")}/${encodeURIComponent(playlist.password ?? "")}`;
  if (kind === "live") return `${base}/live/${auth}/${itemId}.m3u8`;
  const segment = kind === "movie" ? "movie" : "series";
  return `${base}/${segment}/${auth}/${itemId}.${ext || "mp4"}`;
}
