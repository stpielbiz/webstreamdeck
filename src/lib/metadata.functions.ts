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
    const rows: Array<{
      lookup_key: string;
      resolved_title: string | null;
      genres: string[] | null;
      year: number | null;
      poster_url: string | null;
      backdrop_url: string | null;
      overview: string | null;
      source: "tmdb" | "ai" | "none";
    }> = [];

    for (let index = 0; index < keys.length; index += 150) {
      const { data: chunk, error } = await context.supabase
        .from("title_metadata")
        .select("lookup_key, resolved_title, genres, year, poster_url, backdrop_url, overview, source")
        .eq("item_kind", data.kind)
        .in("lookup_key", keys.slice(index, index + 150));
      if (error) throw new Error(error.message);
      rows.push(...(chunk ?? []));
    }

    const byKey = new Map(rows.map((row) => [row.lookup_key, row]));
    return Object.fromEntries(
      entries.flatMap((entry) => {
        const row = byKey.get(entry.key);
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
        } satisfies TitleMetadata]];
      }),
    );
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
