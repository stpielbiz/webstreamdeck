import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";

import { getPopular } from "@/lib/popular.functions";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/lib/iptv-types";
import { groupCatalogItems, mediaMatchKey, type TitleVariant } from "@/lib/title-variants";

const norm = mediaMatchKey;

/** "Popular on Stream Deck" top 10 row; resolves a pick against the user's own playlist. */
export function PopularRow({
  kind,
  tv = false,
  items,
  metadata,
  onOpen,
}: {
  kind: "movie" | "series";
  tv?: boolean;
  items: CatalogItem[];
  metadata?: Record<string, { title?: string | null; year?: string | number | null } | undefined> | undefined;
  onOpen: (id: string, trigger?: HTMLElement | null, variants?: TitleVariant[]) => void;
}) {
  const fetchPopular = useServerFn(getPopular);
  const groups = useMemo(() => groupCatalogItems(items, metadata), [items, metadata]);

  const popular = useQuery({
    queryKey: ["popular", kind],
    queryFn: () => fetchPopular({ data: { kind } }),
    staleTime: 10 * 60_000,
  });

  const rows = popular.data ?? [];
  if (rows.length < 3) return null;

  const pick = (title: string) => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = norm(title);
    const match = groups.find((group) => norm(group.title) === target) ?? groups.find((group) => norm(group.title).includes(target));
    if (match) onOpen(match.item.id, trigger, match.variants);
    else toast("Not in your playlist", { description: title });
  };

  return (
    <section className={cn("mb-6", tv && "mb-3")}>
      <h2 className={cn("mb-3 flex items-center gap-2 font-display font-semibold", tv ? "mb-2 text-lg" : "text-lg")}>
        <Flame className={cn("text-primary", tv ? "size-4" : "size-5")} /> Popular on Stream Deck
      </h2>
      <div className={cn("flex gap-3 overflow-x-auto pb-2", tv && "gap-2")}>
        {rows.map((row, index) => (
          <button
            key={row.title}
            data-tv-focus
            data-focus-key={`popular-${index}`}
            type="button"
            onClick={() => pick(row.title)}
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-lg bg-secondary text-left outline-none ring-primary focus-visible:ring-2 focus:ring-2",
              tv ? "w-24" : "w-28",
            )}
          >
            <div className="aspect-[2/3] w-full bg-muted">
              {row.posterUrl && <img src={row.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <span className={cn("absolute left-1.5 top-1 font-display font-black text-primary drop-shadow", tv ? "text-xl" : "text-3xl")}>{index + 1}</span>
            <p className={cn("truncate px-2 text-xs", tv ? "py-1" : "py-1.5")}>{row.title}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
