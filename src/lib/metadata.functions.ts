import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import type { TitleMetadata } from "./metadata.server";

const schema = z.object({
  playlistId: z.string().uuid(),
  kind: z.enum(["movie", "series"]),
  names: z.array(z.string().min(1).max(300)).min(1).max(120),
});

const cachedSchema = z.object({
  playlistId: z.string().uuid(),
  kind: z.enum(["movie", "series"]),
  names: z.array(z.string().min(1).max(300)).max(5000),
});

/** Return only system metadata that is already saved in the shared cache. */
export const getCachedTitleMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cachedSchema.parse(input))
  .handler(async ({ data, context }): Promise<Record<string, TitleMetadata>> => {
    const { data: playlist, error: playlistError } = await context.supabase
      .from("playlists")
      .select("id")
      .eq("id", data.playlistId)
      .maybeSingle();
    if (playlistError) throw new Error(playlistError.message);
    if (!playlist) throw new Error("Playlist not found");

    const { lookupKeyFor } = await import("./metadata.server");
    const entries = data.names.map((name) => ({ name, ...lookupKeyFor(name) }));
    const keys = [...new Set(entries.map((entry) => entry.key).filter(Boolean))];
    // Rows saved before the year joined the lookup key are stored under the
    // bare title; query those too and match them by year below.
    const queryKeys = [...keys];
    for (const key of keys) {
      const pipe = key.lastIndexOf("|");
      if (pipe === -1) continue;
      const bare = key.slice(0, pipe);
      if (bare && !keys.includes(bare)) queryKeys.push(bare);
    }
    const rows: Array<{
      lookup_key: string;
      resolved_title: string | null;
      genres: string[] | null;
      year: number | null;
      poster_url: string | null;
      backdrop_url: string | null;
      overview: string | null;
      source: "tmdb" | "ai" | "none";
      cast_names: string[];
    }> = [];

    const chunks: string[][] = [];
    for (let index = 0; index < queryKeys.length; index += 300) chunks.push(queryKeys.slice(index, index + 300));
    for (let start = 0; start < chunks.length; start += 12) {
      const results = await Promise.all(chunks.slice(start, start + 12).map((slice) =>
        context.supabase
          .from("title_metadata")
          .select("lookup_key, resolved_title, genres, year, poster_url, backdrop_url, overview, source, cast_names")
          .eq("item_kind", data.kind)
          .in("lookup_key", slice),
      ));
      for (const { data: chunk, error } of results) {
        if (error) throw new Error(error.message);
        rows.push(...(chunk ?? []).map((row) => ({
          lookup_key: row.lookup_key,
          resolved_title: row.resolved_title,
          genres: row.genres,
          year: row.year,
          poster_url: row.poster_url,
          backdrop_url: row.backdrop_url,
          overview: row.overview,
          source: (row.source === "tmdb" || row.source === "ai" ? row.source : "none") as "tmdb" | "ai" | "none",
          cast_names: row.cast_names ?? [],
        })));
      }
    }

    const byKey = new Map(rows.map((row) => [row.lookup_key, row]));
    return Object.fromEntries(
      entries.flatMap((entry) => {
        let row = byKey.get(entry.key);
        if (!row) {
          const pipe = entry.key.lastIndexOf("|");
          if (pipe !== -1) {
            const bare = byKey.get(entry.key.slice(0, pipe));
            const wantedYear = Number(entry.key.slice(pipe + 1));
            if (bare && (bare.year === wantedYear || bare.year === null)) row = bare;
          }
        }
        if (!row) return [];
        return [[entry.name, {
          key: entry.key,
          title: row.resolved_title,
          genres: row.genres ?? [],
          year: row.year,
          poster: row.poster_url,
          backdrop: row.backdrop_url,
          overview: row.overview,
          source: row.source,
          cast: row.cast_names,
        } satisfies TitleMetadata]];
      }),
    );
  });

/**
 * Search the shared metadata store by actor name. Returns lookup keys of
 * titles whose saved cast matches, so search works before local backfill.
 */
export const searchTitlesByCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(2).max(100) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ movie: string[]; series: string[] }> => {
    const pattern = `%${data.query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const fetch = async (kind: "movie" | "series") => {
      const { data: rows, error } = await context.supabase
        .from("title_metadata")
        .select("lookup_key")
        .eq("item_kind", kind)
        .filter("cast_names::text", "ilike", pattern)
        .limit(500);
      if (error) throw new Error(error.message);
      return (rows ?? []).map((row) => row.lookup_key as string);
    };
    const [movie, series] = await Promise.all([fetch("movie"), fetch("series")]);
    return { movie, series };
  });

/**
 * Resolve genre/year/artwork for a batch of provider titles.
 * Cached lookups return without touching TMDB or the AI.
 */
export const enrichTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<Record<string, TitleMetadata>> => {
    // The playlist must belong to the caller (RLS enforces ownership).
    const { data: playlist, error } = await context.supabase
      .from("playlists")
      .select("id")
      .eq("id", data.playlistId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!playlist) throw new Error("Playlist not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveTitles } = await import("./metadata.server");

    return resolveTitles(
      supabaseAdmin as unknown as Parameters<typeof resolveTitles>[0],
      data.names,
      data.kind,
      {
        tmdb: process.env["TMDB_API_KEY"] || undefined,
        lovable: process.env["LOVABLE_API_KEY"] || undefined,
      },
    );
  });

/**
 * Background backfill for any signed-in user: resolves a small batch of
 * titles that have no saved details (or no cast yet) into the shared store.
 */
export const backfillTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      playlistId: z.string().uuid(),
      kind: z.enum(["movie", "series"]),
      names: z.array(z.string().min(1).max(300)).min(1).max(20),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Record<string, TitleMetadata>> => {
    const { data: playlist } = await context.supabase
      .from("playlists").select("id").eq("id", data.playlistId).maybeSingle();
    if (!playlist) throw new Error("Playlist not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveTitles } = await import("./metadata.server");
    return resolveTitles(
      supabaseAdmin as unknown as Parameters<typeof resolveTitles>[0],
      data.names,
      data.kind,
      {
        tmdb: process.env["TMDB_API_KEY"] || undefined,
        lovable: process.env["LOVABLE_API_KEY"] || undefined,
      },
    );
  });

/**
 * Admin-only bulk refresh: resolves larger batches of titles missing details
 * as fast as the caller drives it (already-checked titles return from cache).
 */
export const adminRefreshTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      kind: z.enum(["movie", "series"]),
      names: z.array(z.string().min(1).max(300)).min(1).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Record<string, TitleMetadata>> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveTitles } = await import("./metadata.server");
    return resolveTitles(
      supabaseAdmin as unknown as Parameters<typeof resolveTitles>[0],
      data.names,
      data.kind,
      {
        tmdb: process.env["TMDB_API_KEY"] || undefined,
        lovable: process.env["LOVABLE_API_KEY"] || undefined,
      },
    );
  });
