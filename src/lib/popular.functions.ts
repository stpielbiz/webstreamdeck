import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PopularTitle = { title: string; posterUrl: string | null; viewers: number };

/** Most-watched titles across all users in the last 7 days (aggregate only). */
export const getPopular = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(["movie", "series"]) }).parse(input))
  .handler(async ({ data, context }): Promise<PopularTitle[]> => {
    const { data: rows, error } = await context.supabase.rpc("popular_titles", {
      _kind: data.kind,
      _days: 7,
      _lim: 10,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: { title: string; poster_url: string | null; viewers: number }) => ({
      title: r.title,
      posterUrl: r.poster_url,
      viewers: Number(r.viewers),
    }));
  });
