/**
 * Smart title enrichment.
 *
 * Provider titles look like "EN - The Undeserving (2026)" or "NF - Black Mass".
 * We normalise them, look them up in TMDB when a key is available, and fall
 * back to a Lovable AI classification for anything TMDB does not know.
 * Everything is cached in `title_metadata` so a title is only resolved once.
 */

export interface TitleMetadata {
  key: string;
  title: string | null;
  genres: string[];
  year: number | null;
  poster: string | null;
  backdrop: string | null;
  overview: string | null;
  source: "tmdb" | "ai" | "none";
  /** Main actors, top-billed first. */
  cast: string[];
}

const QUALITY_WORDS =
  /\b(4k|uhd|fhd|hd|sd|hevc|x265|x264|multi|multisub|sub|subs|dub|dubbed|vf|vo|vostfr|imax|remux|web[- ]?dl|bluray)\b/gi;

/** Turn a provider title into a clean title plus a release year, when present. */
export function normalizeTitle(raw: string): { title: string; year: number | null } {
  let text = raw.replace(/\.(mp4|mkv|avi|ts)$/i, "");

  // Leading provider/language prefixes: "EN - ", "NF - ", "AR| ", "[FR] ".
  text = text.replace(/^\s*[[(|]?[A-Za-z]{2,4}[\])|]?\s*[-–|:]\s*/, " ");
  text = text.replace(/[[(][^\])]*[\])]/g, " ");
  text = text.replace(QUALITY_WORDS, " ");

  const currentYear = new Date().getFullYear();
  let year: number | null = null;
  const years = text.match(/(?:19|20)\d{2}/g);
  if (years) {
    for (const candidate of years) {
      const value = Number(candidate);
      if (value >= 1900 && value <= currentYear + 2) year = value;
    }
    if (year !== null) text = text.replace(new RegExp(`\\b${year}\\b`, "g"), " ");
  }

  const title = text
    .replace(/[-–_|:]+\s*$/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title, year };
}

/** Cache key: normalised lowercase title plus year when known. */
export function lookupKeyFor(raw: string): { key: string; title: string; year: number | null } {
  const { title, year } = normalizeTitle(raw);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return { key: year ? `${slug}|${year}` : slug, title, year };
}

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";

const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action",
  10762: "Family",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi",
  10766: "Drama",
  10767: "Talk Show",
  10768: "War",
};

interface TmdbResult {
  id?: number;
  title?: string;
  name?: string;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  popularity?: number;
}

/** Look a single title up in TMDB. Returns null when nothing matches. */
async function tmdbLookup(
  apiKey: string,
  title: string,
  year: number | null,
  kind: "movie" | "series",
): Promise<TitleMetadata | null> {
  const path = kind === "movie" ? "movie" : "tv";
  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
    include_adult: "false",
    language: "en-US",
  });
  if (year) params.set(kind === "movie" ? "primary_release_year" : "first_air_date_year", String(year));

  let response: Response;
  try {
    response = await fetch(`https://api.themoviedb.org/3/search/${path}?${params.toString()}`);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const payload = (await response.json()) as { results?: TmdbResult[] };
  const results = payload.results ?? [];
  if (results.length === 0) return null;

  const best = results
    .slice()
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0]!;
  const date = best.release_date || best.first_air_date || "";
  const genres = [
    ...new Set((best.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean) as string[]),
  ];

  let cast: string[] = [];
  if (best.id) {
    try {
      const credits = await fetch(
        `https://api.themoviedb.org/3/${path}/${best.id}/credits?api_key=${encodeURIComponent(apiKey)}`,
      );
      if (credits.ok) {
        const body = (await credits.json()) as { cast?: { name?: string }[] };
        cast = (body.cast ?? []).map((c) => c.name).filter(Boolean).slice(0, 8) as string[];
      }
    } catch {
      // Cast is optional.
    }
  }

  return {
    key: "",
    title: best.title || best.name || title,
    genres,
    year: date ? Number(date.slice(0, 4)) || year : year,
    poster: best.poster_path ? `${TMDB_IMAGE}${best.poster_path}` : null,
    backdrop: best.backdrop_path ? `${TMDB_BACKDROP}${best.backdrop_path}` : null,
    overview: best.overview || null,
    source: "tmdb",
    cast,
  };
}

const AI_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sports",
  "Thriller",
  "War",
  "Western",
  "Reality",
  "Kids",
  "Unknown",
];

interface AiClassification {
  index: number;
  genres: string[];
  year: number | null;
  cast: string[];
}

/** Classify a batch of titles with Lovable AI when TMDB has no match. */
async function aiClassify(
  apiKey: string,
  titles: { title: string; year: number | null }[],
  kind: "movie" | "series",
): Promise<Map<number, AiClassification>> {
  const out = new Map<number, AiClassification>();
  if (titles.length === 0) return out;

  const list = titles
    .map((entry, index) => `${index}. ${entry.title}${entry.year ? ` (${entry.year})` : ""}`)
    .join("\n");

  const body = {
    model: "openai/gpt-6-astra",
    stream: true,
    reasoning: { effort: "low" as const },
    instructions:
      `You classify ${kind === "movie" ? "films" : "TV shows"} by genre. For each numbered ` +
      `title, return one to three genres chosen only from this list: ${AI_GENRES.join(", ")}. ` +
      `Use "Unknown" when you do not recognise the title. Return the release year when you ` +
      `know it, otherwise null. Return up to 6 top-billed actors in "cast" when you know them, ` +
      `otherwise an empty array. Return one entry per input index.`,
    input: list,
    text: {
      format: {
        type: "json_schema" as const,
        name: "classification",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  index: { type: "number" },
                  genres: { type: "array", items: { type: "string", enum: AI_GENRES } },
                  year: { type: ["number", "null"] },
                  cast: { type: "array", items: { type: "string" } },
                },
                required: ["index", "genres", "year", "cast"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  };

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return out;
  }
  if (!response.ok || !response.body) return out;

  // Accumulate the streamed output text.
  let text = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text) {
          if (!text) text = event.response.output_text;
        }
      } catch {
        // Ignore keep-alive and unparsable events.
      }
    }
  }

  try {
    const parsed = JSON.parse(text) as { items?: AiClassification[] };
    for (const entry of parsed.items ?? []) {
      if (typeof entry.index !== "number") continue;
      const genres = (entry.genres ?? []).filter((genre) => genre && genre !== "Unknown");
      const cast = Array.isArray(entry.cast) ? entry.cast.filter((n) => typeof n === "string" && n.trim()).slice(0, 8) : [];
      out.set(entry.index, { index: entry.index, genres, year: entry.year ?? null, cast });
    }
  } catch {
    return out;
  }

  return out;
}

const AI_BATCH = 25;

type AdminClient = {
  from: (table: "title_metadata") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => { in: (column: string, values: string[]) => Promise<{ data: unknown[] | null }> };
    };
    upsert: (rows: unknown[], options: { onConflict: string }) => Promise<{ error: unknown }>;
  };
};

interface CachedRow {
  lookup_key: string;
  resolved_title: string | null;
  genres: string[] | null;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  source: TitleMetadata["source"];
  cast_names: string[] | null;
  cast_checked: boolean | null;
}

/**
 * Resolve metadata for a list of provider titles: cache first, then TMDB,
 * then a single AI batch for the leftovers. Newly resolved rows are cached.
 */
export async function resolveTitles(
  admin: AdminClient,
  names: string[],
  kind: "movie" | "series",
  keys: { tmdb?: string | undefined; lovable?: string | undefined },
): Promise<Record<string, TitleMetadata>> {
  const wanted = new Map<string, { title: string; year: number | null }>();
  const byName = new Map<string, string>();
  for (const name of names) {
    const { key, title, year } = lookupKeyFor(name);
    if (!key) continue;
    byName.set(name, key);
    if (!wanted.has(key)) wanted.set(key, { title, year });
  }

  const resolved = new Map<string, TitleMetadata>();
  const allKeys = [...wanted.keys()];

  for (let index = 0; index < allKeys.length; index += 200) {
    const slice = allKeys.slice(index, index + 200);
    const { data } = await admin
      .from("title_metadata")
      .select("lookup_key, resolved_title, genres, year, poster_url, backdrop_url, overview, source, cast_names, cast_checked")
      .eq("item_kind", kind)
      .in("lookup_key", slice);
    for (const row of (data ?? []) as CachedRow[]) {
      // Rows saved before cast existed are looked up again.
      if (!row.cast_checked) continue;
      resolved.set(row.lookup_key, {
        key: row.lookup_key,
        title: row.resolved_title,
        genres: row.genres ?? [],
        year: row.year,
        poster: row.poster_url,
        backdrop: row.backdrop_url,
        overview: row.overview,
        source: row.source,
        cast: row.cast_names ?? [],
      });
    }
  }

  const missing = allKeys.filter((key) => !resolved.has(key));
  const fresh: TitleMetadata[] = [];

  // TMDB, a handful at a time to stay well inside its rate limits.
  const stillMissing: string[] = [];
  if (keys.tmdb) {
    for (let index = 0; index < missing.length; index += 8) {
      const slice = missing.slice(index, index + 8);
      const results = await Promise.all(
        slice.map(async (key) => {
          const entry = wanted.get(key)!;
          const found = entry.title ? await tmdbLookup(keys.tmdb!, entry.title, entry.year, kind) : null;
          return { key, found };
        }),
      );
      for (const { key, found } of results) {
        if (found) {
          const record = { ...found, key };
          resolved.set(key, record);
          fresh.push(record);
        } else {
          stillMissing.push(key);
        }
      }
    }
  } else {
    stillMissing.push(...missing);
  }

  // AI fallback for whatever TMDB could not place.
  if (keys.lovable && stillMissing.length > 0) {
    for (let index = 0; index < stillMissing.length; index += AI_BATCH) {
      const slice = stillMissing.slice(index, index + AI_BATCH);
      const inputs = slice.map((key) => wanted.get(key)!);
      const classified = await aiClassify(keys.lovable, inputs, kind);
      slice.forEach((key, position) => {
        const entry = wanted.get(key)!;
        const guess = classified.get(position);
        const record: TitleMetadata = {
          key,
          title: entry.title || null,
          genres: guess?.genres ?? [],
          year: guess?.year ?? entry.year,
          poster: null,
          backdrop: null,
          overview: null,
          source: guess && guess.genres.length > 0 ? "ai" : "none",
        };
        resolved.set(key, record);
        fresh.push(record);
      });
    }
  }

  if (fresh.length > 0) {
    await admin.from("title_metadata").upsert(
      fresh.map((record) => ({
        lookup_key: record.key,
        item_kind: kind,
        resolved_title: record.title,
        genres: record.genres,
        year: record.year,
        poster_url: record.poster,
        backdrop_url: record.backdrop,
        overview: record.overview,
        source: record.source,
      })),
      { onConflict: "lookup_key,item_kind" },
    );
  }

  const out: Record<string, TitleMetadata> = {};
  for (const [name, key] of byName) {
    const record = resolved.get(key);
    if (record) out[name] = record;
  }
  return out;
}
