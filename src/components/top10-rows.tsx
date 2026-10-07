import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Trophy } from "lucide-react";

import { getStreamingTop10 } from "@/lib/top10.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { cn } from "@/lib/utils";

/** Normalise a title for matching across providers (drops tags, years, prefixes). */
export const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/^[a-z]{2,3}\s*[|:-]\s+/, "")
    .replace(/\(\d{4}\)|\[[^\]]*\]|\b(4k|uhd|fhd|hd|sd|multi|vostfr|s\d{1,2}(e\d{1,3})?)\b/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(19|20)\d{2}\s*$/, "")
    .trim();

export function Top10Rows({
  kind,
  tv = false,
  items,
  onOpen,
}: {
  kind: "movie" | "series";
  tv?: boolean;
  items: CatalogItem[];
  onOpen: (id: string, trigger?: HTMLElement | null) => void;
}) {
  const fetchTop = useServerFn(getStreamingTop10);
  const top = useQuery({ queryKey: ["streaming-top10", kind], queryFn: () => fetchTop({ data: { kind } }), staleTime: 6 * 60 * 60_000 });

  const index = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const k = normTitle(item.name);
      const list = map.get(k);
      if (list) list.push(item);
      else map.set(k, [item]);
    }
    return map;
  }, [items]);

  const rows = (["netflix", "prime"] as const).map((service) => {
    const matches = (top.data ?? [])
      .filter((r) => r.service === service)
      .map((r) => {
        const found = index.get(normTitle(r.title));
        if (!found?.length) return null;
        const item = (r.year && found.find((f) => String(f.year ?? "").startsWith(String(r.year)))) || found[0]!;
        return { rank: r.rank, item, poster: item.image || r.poster_url };
      })
      .filter((m): m is NonNullable<typeof m> => !!m);
    return { service, matches };
  });

  return (
    <>
      {rows.map(({ service, matches }) =>
        matches.length === 0 ? null : (
          <section key={service} id={`top10-${service}`} className="mb-6">
            <h2 className={cn("mb-3 flex items-center gap-2 font-display font-semibold", tv ? "text-2xl" : "text-lg")}>
              <Trophy className="size-5 text-primary" /> Top 10 on {service === "netflix" ? "Netflix" : "Prime Video"}
            </h2>
            <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
              {matches.map(({ rank, item, poster }, i) => (
                <button
                  key={item.id}
                  type="button"
                  data-tv-focus
                  data-focus-key={`top10-${service}-${i}`}
                  onClick={(e) => onOpen(item.id, e.currentTarget)}
                  className="group relative w-28 shrink-0 overflow-hidden rounded-md border border-border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="aspect-[2/3] bg-muted">
                    {poster && <img src={poster} alt={item.name} loading="lazy" className="size-full object-cover" />}
                  </div>
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-xs font-bold text-primary-foreground">#{rank}</span>
                  <p className="truncate px-2 py-1 text-xs font-medium">{item.name}</p>
                </button>
              ))}
            </div>
          </section>
        ),
      )}
    </>
  );
}
