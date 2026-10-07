import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Top10Row = { service: "netflix" | "prime"; rank: number; title: string; year: number | null; poster_url: string | null };

const DAY = 24 * 60 * 60_000;

async function fetchNetflix(kind: "movie" | "series") {
  const res = await fetch("https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv");
  if (!res.ok) throw new Error(`netflix ${res.status}`);
  const lines = (await res.text()).split("\n").slice(1).map((l) => l.split("\t"));
  const week = lines[0]?.[0];
  const category = kind === "movie" ? "Films (English)" : "TV (English)";
  const seen = new Set<string>();
  return lines
    .filter((c) => c[0] === week && c[1] === category)
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map((c) => (c[3] ?? "").trim())
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .slice(0, 10)
    .map((title, i) => ({ rank: i + 1, title, year: null as number | null, poster_url: null as string | null }));
}

async function fetchPrime(kind: "movie" | "series") {
  const key = process.env["TMDB_API_KEY"];
  if (!key) return [];
  const type = kind === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${key}&watch_region=US&with_watch_providers=9&with_watch_monetization_types=flatrate&sort_by=popularity.desc&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tmdb ${res.status}`);
  const json = (await res.json()) as { results?: Array<{ title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null }> };
  return (json.results ?? []).slice(0, 10).map((r, i) => ({
    rank: i + 1,
    title: r.title ?? r.name ?? "",
    year: Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
    poster_url: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
  }));
}

export const getStreamingTop10 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["movie", "series"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const read = async () => {
      const { data: rows } = await context.supabase
        .from("streaming_top10")
        .select("service, rank, title, year, poster_url, fetched_at")
        .eq("kind", data.kind)
        .order("rank");
      return rows ?? [];
    };
    let rows = await read();
    const fresh = (service: string) => rows.some((r) => r.service === service && Date.now() - Date.parse(r.fetched_at) < DAY);
    const stale = (["netflix", "prime"] as const).filter((s) => !fresh(s));
    if (stale.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const service of stale) {
        try {
          const list = service === "netflix" ? await fetchNetflix(data.kind) : await fetchPrime(data.kind);
          if (!list.length) continue;
          await supabaseAdmin.from("streaming_top10").delete().eq("service", service).eq("kind", data.kind);
          await supabaseAdmin.from("streaming_top10").insert(list.map((r) => ({ ...r, service, kind: data.kind })));
        } catch (error) {
          console.error("top10 refresh failed", service, error);
        }
      }
      rows = await read();
    }
    return rows.map(({ fetched_at: _f, ...r }) => r) as Top10Row[];
  });
