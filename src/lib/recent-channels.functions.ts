import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface RecentChannel {
  playlistId: string;
  itemId: string;
  title: string;
  logoUrl: string | null;
}

const KEEP = 10;

export const listRecentChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentChannel[]> => {
    const { data, error } = await context.supabase
      .from("recent_channels")
      .select("playlist_id, item_id, title, logo_url")
      .order("watched_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ playlistId: row.playlist_id, itemId: row.item_id, title: row.title, logoUrl: row.logo_url }));
  });

export const touchRecentChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ playlistId: z.string().uuid(), itemId: z.string().min(1), title: z.string(), logoUrl: z.string().nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recent_channels").upsert(
      { user_id: context.userId, playlist_id: data.playlistId, item_id: data.itemId, title: data.title, logo_url: data.logoUrl ?? null, watched_at: new Date().toISOString() },
      { onConflict: "user_id,playlist_id,item_id" },
    );
    if (error) throw new Error(error.message);
    const { data: rows } = await context.supabase
      .from("recent_channels")
      .select("id")
      .eq("playlist_id", data.playlistId)
      .order("watched_at", { ascending: false })
      .range(KEEP, KEEP + 50);
    const stale = (rows ?? []).map((row) => row.id);
    if (stale.length) await context.supabase.from("recent_channels").delete().in("id", stale);
    return { ok: true };
  });
