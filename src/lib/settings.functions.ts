import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface UserSettings {
  syncPlaylists: boolean;
  screenSize: "large" | "medium" | "small";
}

const settingsInput = z.object({
  syncPlaylists: z.boolean(),
  screenSize: z.enum(["large", "medium", "small"]),
});

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSettings> => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("sync_playlists, screen_size")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const parsedScreenSize = z.enum(["large", "medium", "small"]).catch("large").parse(data?.screen_size);
    return {
      syncPlaylists: data?.sync_playlists ?? false,
      screenSize: parsedScreenSize,
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsInput.parse(input))
  .handler(async ({ data, context }): Promise<UserSettings> => {
    const { error } = await context.supabase.from("user_settings").upsert(
      { user_id: context.userId, sync_playlists: data.syncPlaylists, screen_size: data.screenSize, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return data;
  });
