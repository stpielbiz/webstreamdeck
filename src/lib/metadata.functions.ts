import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import type { TitleMetadata } from "./metadata.server";

const schema = z.object({
  playlistId: z.string().uuid(),
  kind: z.enum(["movie", "series"]),
  names: z.array(z.string().min(1).max(300)).min(1).max(120),
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
