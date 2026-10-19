import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface UserSettings {
  syncPlaylists: boolean;
  screenSize: "large" | "medium" | "small";
  backgroundUpdates: boolean;
  sportsEnabled: boolean;
  sportsLeagues: string[];
}

const settingsInput = z.object({
  syncPlaylists: z.boolean(),
  screenSize: z.enum(["large", "medium", "small"]),
  backgroundUpdates: z.boolean(),
  sportsEnabled: z.boolean().default(false),
  sportsLeagues: z.array(z.string().max(20)).max(30).default([]),
});

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSettings> => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("sync_playlists, screen_size, background_updates, sports_enabled, sports_leagues")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const parsedScreenSize = z.enum(["large", "medium", "small"]).catch("large").parse(data?.screen_size);
    return {
      syncPlaylists: data?.sync_playlists ?? false,
      screenSize: parsedScreenSize,
      backgroundUpdates: data?.background_updates ?? true,
      sportsEnabled: data?.sports_enabled ?? false,
      sportsLeagues: data?.sports_leagues ?? [],
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsInput.parse(input))
  .handler(async ({ data, context }): Promise<UserSettings> => {
    const { error } = await context.supabase.from("user_settings").upsert(
      {
        user_id: context.userId,
        sync_playlists: data.syncPlaylists,
        screen_size: data.screenSize,
        background_updates: data.backgroundUpdates,
        sports_enabled: data.sportsEnabled,
        sports_leagues: data.sportsLeagues,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return data;
  });
