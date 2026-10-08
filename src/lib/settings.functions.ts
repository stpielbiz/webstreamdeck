import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface UserSettings {
  syncPlaylists: boolean;
}

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSettings> => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("sync_playlists")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { syncPlaylists: data?.sync_playlists ?? false };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ syncPlaylists: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<UserSettings> => {
    const { error } = await context.supabase.from("user_settings").upsert(
      { user_id: context.userId, sync_playlists: data.syncPlaylists, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { syncPlaylists: data.syncPlaylists };
  });
