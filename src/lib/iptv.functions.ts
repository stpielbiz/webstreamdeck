import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import type {
  Category,
  CatalogItem,
  CatalogKind,
  MovieDetails,
  NowNext,
  Programme,
  SeriesDetails,
} from "./iptv-types";

export interface PlaylistSummary {
  id: string;
  name: string;
  kind: "xtream" | "m3u";
  serverUrl: string | null;
  username: string | null;
  m3uUrl: string | null;
  createdAt: string;
}

const PLAYLIST_COLUMNS = "id, name, kind, server_url, username, password, m3u_url";

function toSummary(row: {
  id: string;
  name: string;
  kind: "xtream" | "m3u";
  server_url: string | null;
  username: string | null;
  m3u_url: string | null;
  created_at?: string;
}): PlaylistSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    serverUrl: row.server_url,
    username: row.username,
    m3uUrl: row.m3u_url,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export const listPlaylists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlaylistSummary[]> => {
    const { data, error } = await context.supabase
      .from("playlists")
      .select("id, name, kind, server_url, username, m3u_url, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSummary);
  });

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(["xtream", "m3u"]),
    serverUrl: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().optional(),
    m3uUrl: z.string().trim().optional(),
  })
  .refine((value) => (value.kind === "m3u" ? !!value.m3uUrl : !!value.serverUrl && !!value.username), {
    message: "Missing playlist details.",
  });

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<PlaylistSummary> => {
    const provider = await import("./iptv.server");

    if (data.kind === "xtream") {
      await provider.verifyXtream({
        id: "new",
        name: data.name,
        kind: "xtream",
        server_url: data.serverUrl ?? null,
        username: data.username ?? null,
        password: data.password ?? null,
        m3u_url: null,
      });
    } else {
      const response = await provider.providerFetch(data.m3uUrl!, { method: "GET" });
      if (!response.ok) throw new Error(`The playlist link returned an error (${response.status}).`);
      const sample = (await response.text()).slice(0, 2000);
      if (!sample.toUpperCase().includes("#EXTM3U") && !sample.toUpperCase().includes("#EXTINF")) {
        throw new Error("That link does not look like an M3U playlist.");
      }
    }

    const { data: row, error } = await context.supabase
      .from("playlists")
      .insert({
        user_id: context.userId,
        name: data.name,
        kind: data.kind,
        server_url: data.kind === "xtream" ? (data.serverUrl ?? null) : null,
        username: data.kind === "xtream" ? (data.username ?? null) : null,
        password: data.kind === "xtream" ? (data.password ?? null) : null,
        m3u_url: data.kind === "m3u" ? (data.m3uUrl ?? null) : null,
      })
      .select("id, name, kind, server_url, username, m3u_url, created_at")
      .single();
    if (error) throw new Error(error.message);
    return toSummary(row);
  });

export const deletePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("playlists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadPlaylist(
  supabase: { from: (table: "playlists") => any },
  playlistId: string,
) {
  const { data, error } = await supabase
    .from("playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("id", playlistId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That playlist could not be found.");
  return data as {
    id: string;
    name: string;
    kind: "xtream" | "m3u";
    server_url: string | null;
    username: string | null;
    password: string | null;
    m3u_url: string | null;
  };
}

const catalogSchema = z.object({
  playlistId: z.string().uuid(),
  kind: z.enum(["live", "movie", "series"]),
  categoryId: z.string().optional(),
  search: z.string().trim().max(80).optional(),
});

export const getCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    catalogSchema.pick({ playlistId: true, kind: true }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Category[]> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    return provider.fetchCategories(playlist, data.kind as CatalogKind);
  });

export const getItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => catalogSchema.parse(input))
  .handler(async ({ data, context }): Promise<CatalogItem[]> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    return provider.fetchItems(playlist, data.kind as CatalogKind, data.categoryId, data.search);
  });

export const getMovie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ playlistId: z.string().uuid(), id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MovieDetails> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    return provider.fetchMovie(playlist, data.id);
  });

export const getSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ playlistId: z.string().uuid(), id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SeriesDetails> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    return provider.fetchSeries(playlist, data.id);
  });

export const getNowNext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ playlistId: z.string().uuid(), channelIds: z.array(z.string()).max(60) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<NowNext[]> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    return provider.fetchNowNext(playlist, data.channelIds);
  });

export const getSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ playlistId: z.string().uuid(), channelId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Programme[]> => {
    const provider = await import("./iptv.server");
    const playlist = await loadPlaylist(context.supabase, data.playlistId);
    if (playlist.kind !== "xtream") return [];
    try {
      return await provider.xtreamSchedule(playlist, data.channelId);
    } catch {
      return [];
    }
  });

export const getPlayback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        kind: z.enum(["live", "movie", "episode"]),
        itemId: z.string(),
        ext: z.string().nullish(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ url: string; directUrl: string | null; live: boolean }> => {
      const provider = await import("./iptv.server");
      const { proxyUrl } = await import("./stream-token.server");
      const playlist = await loadPlaylist(context.supabase, data.playlistId);
      const upstream = await provider.resolveStreamUrl(
        playlist,
        data.kind,
        data.itemId,
        data.ext ?? undefined,
      );
      // Some providers only allow their own subscriber's network and refuse our
      // server. The player falls back to fetching the stream itself in that case.
      return {
        url: await proxyUrl(playlist.id, upstream),
        directUrl: upstream,
        live: data.kind === "live",
      };
    },
  );

/* ------------------------------------------------------ favourites & progress */

export interface FavoriteRow {
  id: string;
  playlistId: string;
  itemKind: "live" | "movie" | "series" | "episode";
  itemId: string;
  title: string;
  logoUrl: string | null;
}

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteRow[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("id, playlist_id, item_kind, item_id, title, logo_url")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      playlistId: row.playlist_id,
      itemKind: row.item_kind,
      itemId: row.item_id,
      title: row.title,
      logoUrl: row.logo_url,
    }));
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        itemKind: z.enum(["live", "movie", "series", "episode"]),
        itemId: z.string(),
        title: z.string(),
        logoUrl: z.string().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ favorite: boolean }> => {
    const existing = await context.supabase
      .from("favorites")
      .select("id")
      .eq("playlist_id", data.playlistId)
      .eq("item_kind", data.itemKind)
      .eq("item_id", data.itemId)
      .maybeSingle();

    if (existing.data) {
      const { error } = await context.supabase
        .from("favorites")
        .delete()
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
      return { favorite: false };
    }

    const { error } = await context.supabase.from("favorites").insert({
      user_id: context.userId,
      playlist_id: data.playlistId,
      item_kind: data.itemKind,
      item_id: data.itemId,
      title: data.title,
      logo_url: data.logoUrl ?? null,
    });
    if (error) throw new Error(error.message);
    return { favorite: true };
  });

export interface ProgressRow {
  playlistId: string;
  itemKind: "live" | "movie" | "series" | "episode";
  itemId: string;
  seriesId: string | null;
  season: number | null;
  episode: number | null;
  title: string;
  posterUrl: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  /** True when the stream was handed to an external player (position unknown). */
  external: boolean;
  updatedAt: string;
}

export const listProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressRow[]> => {
    const { data, error } = await context.supabase
      .from("watch_progress")
      .select(
        "playlist_id, item_kind, item_id, series_id, season, episode, title, poster_url, position_seconds, duration_seconds, completed, external, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      playlistId: row.playlist_id,
      itemKind: row.item_kind,
      itemId: row.item_id,
      seriesId: row.series_id,
      season: row.season,
      episode: row.episode,
      title: row.title,
      posterUrl: row.poster_url,
      positionSeconds: row.position_seconds,
      durationSeconds: row.duration_seconds,
      completed: row.completed,
      external: row.external,
      updatedAt: row.updated_at,
    }));
  });

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        itemKind: z.enum(["movie", "episode"]),
        itemId: z.string(),
        seriesId: z.string().nullish(),
        season: z.number().int().nullish(),
        episode: z.number().int().nullish(),
        title: z.string(),
        posterUrl: z.string().nullish(),
        positionSeconds: z.number().min(0),
        durationSeconds: z.number().min(0).nullish(),
        external: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const completed =
      !!data.durationSeconds && data.durationSeconds > 0
        ? data.positionSeconds / data.durationSeconds > 0.95
        : false;

    // An external hand-off carries no position; keep any real resume point
    // already saved instead of wiping it.
    let positionSeconds = data.positionSeconds;
    let durationSeconds = data.durationSeconds ?? null;
    let completedFlag = completed;
    if (data.external && data.positionSeconds === 0) {
      const { data: existing } = await context.supabase
        .from("watch_progress")
        .select("position_seconds, duration_seconds, completed")
        .eq("user_id", context.userId)
        .eq("playlist_id", data.playlistId)
        .eq("item_kind", data.itemKind)
        .eq("item_id", data.itemId)
        .maybeSingle();
      if (existing) {
        positionSeconds = existing.position_seconds;
        durationSeconds = existing.duration_seconds;
        completedFlag = existing.completed;
      }
    }

    const { error } = await context.supabase.from("watch_progress").upsert(
      {
        user_id: context.userId,
        playlist_id: data.playlistId,
        item_kind: data.itemKind,
        item_id: data.itemId,
        series_id: data.seriesId ?? null,
        season: data.season ?? null,
        episode: data.episode ?? null,
        title: data.title,
        poster_url: data.posterUrl ?? null,
        position_seconds: positionSeconds,
        duration_seconds: durationSeconds,
        completed: completedFlag,
        external: data.external ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,playlist_id,item_kind,item_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, completed: completedFlag };
  });

export const clearProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ playlistId: z.string().uuid(), itemId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watch_progress")
      .delete()
      .eq("playlist_id", data.playlistId)
      .eq("item_id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
