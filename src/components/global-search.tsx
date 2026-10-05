import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getItems } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";

const LIMIT = 30;

/** Home-page search across live channels, movies and shows of the active playlist. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchItems = useServerFn(getItems);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const enabled = !!activeId && query.length > 0;
  const opts = (kind: "live" | "movie" | "series", key: string) => ({
    queryKey: [key, activeId, kind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind } }),
    enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  const live = useQuery(opts("live", "global-search-live"));
  const movies = useQuery(opts("movie", "system-catalogue"));
  const shows = useQuery(opts("series", "system-catalogue"));
  const match = (items?: CatalogItem[]) => (items ?? []).filter((item) => item.name.toLowerCase().includes(query)).slice(0, LIMIT);
  const groups = useMemo(() => [
    { kind: "live" as const, title: "Channels", items: match(live.data), loading: live.isFetching },
    { kind: "movie" as const, title: "Movies", items: match(movies.data), loading: movies.isFetching },
    { kind: "series" as const, title: "Shows", items: match(shows.data), loading: shows.isFetching },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [query, live.data, movies.data, shows.data, live.isFetching, movies.isFetching, shows.isFetching]);

  const open = (kind: "live" | "movie" | "series", id: string) => {
    if (kind === "live") void navigate({ to: "/tv/live", search: { channel: id } });
    else if (kind === "movie") void navigate({ to: "/tv/watch/movie/$id", params: { id }, search: { from: "home" } });
    else void navigate({ to: "/tv/watch/series/$id", params: { id }, search: { from: "home" } });
  };
  const firstResult = groups.find((group) => group.items.length > 0);

  return (
    <section className="space-y-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          data-tv-focus
          data-zone-entry="true"
          data-zone-edge-left="true"
          data-focus-key="global-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "ArrowDown") {
              const first = document.querySelector<HTMLElement>('[data-focus-key="global-result-first"]');
              if (first) { event.preventDefault(); event.stopPropagation(); first.focus(); }
            }
          }}
          placeholder="Search channels, movies and shows"
          className="pl-9 pr-9"
        />
        {search && (
          <Button type="button" variant="ghost" size="icon" aria-label="Clear search" className="absolute right-0 top-0" onClick={() => setSearch("")}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      {enabled && (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.kind}>
              <h3 className="mb-2 font-display text-base font-semibold">{group.title} <span className="text-xs font-normal text-muted-foreground">· {group.loading && group.items.length === 0 ? "searching…" : group.items.length}</span></h3>
              {group.items.length > 0 ? (
                <div className="scrollbar-thin flex gap-3 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-1">
                  {group.items.map((item, index) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      data-tv-focus
                      data-zone-edge-left={index === 0 ? "true" : undefined}
                      data-focus-key={group === firstResult && index === 0 ? "global-result-first" : undefined}
                      onClick={() => open(group.kind, item.id)}
                      className={`h-auto shrink-0 flex-col items-stretch justify-start overflow-hidden rounded p-0 text-left focus:scale-[1.025] focus:ring-2 focus:ring-primary motion-reduce:transform-none ${group.kind === "live" ? "w-28" : "w-24"}`}
                    >
                      <span className={`relative block w-full overflow-hidden rounded border border-border bg-muted ${group.kind === "live" ? "aspect-square" : "aspect-[2/3]"}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" className={`size-full ${group.kind === "live" ? "object-contain p-2" : "object-cover"}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />
                        ) : null}
                        <span className="absolute inset-0 -z-0 grid place-items-center px-1 text-center text-[10px] text-muted-foreground">{item.image ? "" : item.name}</span>
                      </span>
                      <span className="block truncate px-1 pb-1 pt-1.5 text-xs font-semibold">{item.name}</span>
                    </Button>
                  ))}
                </div>
              ) : !group.loading ? <p className="text-xs text-muted-foreground">No matches.</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
