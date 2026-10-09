import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Trophy } from "lucide-react";

import { getStreamingTop10 } from "@/lib/top10.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { groupCatalogItems, mediaMatchKey, type TitleVariant } from "@/lib/title-variants";
import { cn } from "@/lib/utils";

/** Normalise a title for matching across providers (drops tags, years, prefixes). */
export const normTitle = (s: string) =>
  mediaMatchKey(s);

export type Top10Service = "netflix" | "prime";

export function Top10Row({
  kind,
  tv = false,
  items,
  metadata,
  service,
  onOpen,
}: {
  kind: "movie" | "series";
  tv?: boolean;
  items: CatalogItem[];
  metadata?: Record<string, { title: string | null }> | undefined;
  service: Top10Service;
  onOpen: (id: string, trigger?: HTMLElement | null, variants?: TitleVariant[]) => void;
}) {
  const fetchTop = useServerFn(getStreamingTop10);
  const top = useQuery({ queryKey: ["streaming-top10", kind], queryFn: () => fetchTop({ data: { kind } }), staleTime: 6 * 60 * 60_000 });

  const index = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    const add = (k: string, item: CatalogItem) => {
      if (!k) return;
      const list = map.get(k);
      if (!list) map.set(k, [item]);
      else if (!list.includes(item)) list.push(item);
    };
    for (const group of groupCatalogItems(items, metadata)) {
      add(normTitle(group.title), group.item);
      for (const variant of group.variants) add(normTitle(variant.item.name), group.item);
    }
    return map;
  }, [items, metadata]);

  const entries = (top.data ?? [])
    .filter((r) => r.service === service)
    .map((r) => {
      const found = index.get(normTitle(r.title));
      const item = found?.length
        ? (r.year && found.find((f) => String(f.year ?? "").startsWith(String(r.year)))) || found[0]!
        : null;
       const variants = item ? groupCatalogItems(items, metadata).find((group) => group.variants.some((variant) => variant.item.id === item.id))?.variants : undefined;
       return { rank: r.rank, item, variants, title: r.title, poster: item?.image || r.poster_url };
    });

  if (entries.length === 0) return null;

  return (
    <section id={`top10-${service}`} className={cn("mb-6", tv && "mb-3")}>
      <h2 className={cn("mb-3 flex items-center gap-2 font-display font-semibold", tv ? "mb-2 text-lg" : "text-lg")}>
        <Trophy className={cn("text-primary", tv ? "size-4" : "size-5")} /> Top 10 on {service === "netflix" ? "Netflix" : "Prime Video"}
      </h2>
      <div className={cn("scrollbar-thin flex gap-3 overflow-x-auto pb-2", tv && "gap-2")}>
         {entries.map(({ rank, item, variants, title, poster }, i) =>
          item ? (
            <button
              key={`${service}-${rank}`}
              type="button"
              data-tv-focus
              data-focus-key={`top10-${service}-${i}`}
               onClick={(e) => onOpen(item.id, e.currentTarget, variants)}
              className={cn("group relative shrink-0 overflow-hidden rounded-md border border-border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-primary", tv ? "w-24" : "w-28")}
            >
              <div className="aspect-[2/3] bg-muted">
                {poster && <img src={poster} alt={item.name} loading="lazy" className="size-full object-cover" />}
              </div>
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-xs font-bold text-primary-foreground">#{rank}</span>
              <p className="truncate px-2 py-1 text-xs font-medium">{item.name}</p>
            </button>
          ) : (
            <div
              key={`${service}-${rank}`}
              className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-card opacity-60", tv ? "w-24" : "w-28")}
            >
              <div className="aspect-[2/3] bg-muted">
                {poster && <img src={poster} alt={title} loading="lazy" className="size-full object-cover opacity-30 grayscale" />}
              </div>
              <span className="absolute left-1 top-1 rounded bg-muted px-1.5 text-xs font-bold text-muted-foreground">#{rank}</span>
              <div className="absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-center">
                <span className="rounded bg-background/90 px-1.5 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                  Not in your list
                </span>
              </div>
              <p className="truncate px-2 py-1 text-xs font-medium text-muted-foreground">{title}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
