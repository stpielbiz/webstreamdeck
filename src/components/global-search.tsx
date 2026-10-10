import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Play, Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TitleDetailsDialog } from "@/components/title-details-dialog";

import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getItems } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { isFavorite, useFavorites, useToggleFavorite } from "@/lib/library-hooks";
import { cn } from "@/lib/utils";
import { useAppSearchFocus } from "@/lib/app-search";
import { groupCatalogItems, type TitleGroup } from "@/lib/title-variants";
import { resolveFranchise } from "@/lib/franchise.functions";
import { searchTitlesByCast } from "@/lib/metadata.functions";
import { lookupKeyFor } from "@/lib/title-key";
import { FranchiseCard, FranchiseList, useFranchiseMatches } from "@/components/franchise-list";

const LIMIT = 30;
const STORAGE_KEY = "streamdeck-home-search";
type Kind = "live" | "movie" | "series";

/** Home-page search across shows, movies and channels of the active playlist, shown as a list. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchItems = useServerFn(getItems);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [search, setSearchState] = useState("");
  const [openGroup, setOpenGroup] = useState<{ kind: "movie" | "series"; group: TitleGroup } | null>(null);
  const setSearch = (value: string) => {
    setSearchState(value);
    try { sessionStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
  };
  useEffect(() => {
    try { const saved = sessionStorage.getItem(STORAGE_KEY); if (saved) setSearchState(saved); } catch { /* ignore */ }
  }, []);
  useAppSearchFocus("global-search");
  const query = search.trim().toLowerCase();
  const enabled = !!activeId && query.length > 0;
  const opts = (kind: Kind, key: string) => ({
    queryKey: [key, activeId, kind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind } }),
    enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  const live = useQuery(opts("live", "global-search-live"));
  const movies = useQuery(opts("movie", "system-catalogue"));
  const shows = useQuery(opts("series", "system-catalogue"));
  const client = useQueryClient();
  const castSearch = useServerFn(searchTitlesByCast);
  // Ask the shared details store for actor matches, so search works even
  // before this device has downloaded every title's details.
  const castHits = useQuery({
    queryKey: ["cast-search", query],
    queryFn: () => castSearch({ data: { query } }),
    enabled: enabled && query.length >= 3,
    staleTime: 30 * 60_000,
  });
  const castFor = (kind: "movie" | "series") => {
    const out: Record<string, string[]> = {};
    for (const [, data] of client.getQueriesData<Record<string, { cast?: string[] }>>({ queryKey: ["cached-title-metadata", activeId, kind] })) {
      for (const [name, meta] of Object.entries(data ?? {})) if (meta?.cast?.length) out[name] = meta.cast;
    }
    return out;
  };
  const match = (kind: "movie" | "series" | "live", items?: CatalogItem[], cast?: Record<string, string[]>, grouped = false) => (grouped ? groupCatalogItems(items ?? []) : (items ?? []).map((item) => ({ key: item.id, item, variants: [], title: item.name, year: item.year ?? null }))).filter((group) =>
    group.title.toLowerCase().includes(query)
    || group.variants.some((variant) => variant.item.name.toLowerCase().includes(query))
    || (query.length >= 3 && (cast?.[group.item.name] ?? []).some((actor) => actor.toLowerCase().includes(query)))
    || (query.length >= 3 && kind !== "live" && (castHits.data?.[kind as "movie" | "series"] ?? []).includes(lookupKeyFor(group.item.name).key)),
  ).slice(0, LIMIT);
  const groups = useMemo(() => [
    { kind: "series" as const, title: "Shows", items: match("series", shows.data, castFor("series"), true), loading: shows.isFetching },
    { kind: "movie" as const, title: "Movies", items: match("movie", movies.data, castFor("movie"), true), loading: movies.isFetching },
    { kind: "live" as const, title: "Channels", items: match("live", live.data), loading: live.isFetching },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [query, live.data, movies.data, shows.data, live.isFetching, movies.isFetching, shows.isFetching, castHits.data]);

  const open = (kind: Kind, group: TitleGroup) => {
    if (kind === "live") void navigate({ to: "/tv/live", search: { channel: group.item.id } });
    else setOpenGroup({ kind, group });
  };
  // Franchise of the best movie/show match, resolved after typing settles.
  const topMatch = groups.slice(0, 2).map((g) => ({ kind: g.kind, first: g.items[0] }))
    .find((g) => g.first && g.first.title.toLowerCase().startsWith(query)) ?? groups.slice(0, 2).map((g) => ({ kind: g.kind, first: g.items[0] })).find((g) => g.first);
  const [settled, setSettled] = useState<{ title: string; kind: "movie" | "series" } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(query.length >= 3 && topMatch?.first ? { title: topMatch.first.title, kind: topMatch.kind as "movie" | "series" } : null), 700);
    return () => window.clearTimeout(t);
  }, [query, topMatch?.first?.title, topMatch?.kind]);
  const lookup = useServerFn(resolveFranchise);
  const franchise = useQuery({
    queryKey: ["franchise", settled?.title, settled?.kind],
    queryFn: () => {
      if (!settled) return null;
      return lookup({ data: settled });
    },
    enabled: !!settled,
    staleTime: Infinity,
  });
  const [franchiseOpen, setFranchiseOpen] = useState(false);
  const franchiseMatches = useFranchiseMatches(franchise.data, movies.data, shows.data);
  const owned = franchiseMatches.filter((m) => m.group).length;
  const showFranchise = enabled && !!franchise.data && owned > 0;
  const firstResult = showFranchise ? undefined : groups.find((group) => group.items.length > 0);
  const backToSearch = () => document.querySelector<HTMLElement>('[data-focus-key="global-search"]')?.focus();

  return (
    <section className="space-y-3">
      <div className="flex max-w-2xl items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            data-tv-focus
            data-zone-entry="true"
            data-app-search="true"
            data-focus-key="global-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "ArrowDown") {
                const first = document.querySelector<HTMLElement>('[data-focus-key="global-result-first"]');
                if (first) { event.preventDefault(); event.stopPropagation(); first.focus(); }
              }
            }}
            placeholder="Search shows, movies and channels"
            className="h-9 pl-9 pr-9"
          />
          {search && (
            <Button type="button" variant="ghost" size="icon" aria-label="Clear search" className="absolute right-0 top-0 h-9" onClick={() => setSearch("")}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {enabled && (
        <div className="max-w-3xl space-y-4" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); backToSearch(); } }}>
          {showFranchise && franchise.data && <FranchiseCard franchise={franchise.data} owned={owned} onOpen={() => setFranchiseOpen(true)} />}
          {groups.map((group) => (
            <div key={group.kind}>
              <h3 className="mb-1 font-display text-sm font-semibold text-primary">{group.title} <span className="text-xs font-normal text-muted-foreground">· {group.loading && group.items.length === 0 ? "searching…" : group.items.length}</span></h3>
              {group.items.length > 0 ? (
                <ul className="divide-y divide-border rounded border border-border bg-card">
                  {group.items.map((titleGroup, index) => {
                    const item = titleGroup.item;
                    const favouriteVariant = titleGroup.variants.find((variant) => isFavorite(favorites.data, activeId, group.kind, variant.item.id));
                    const fav = !!favouriteVariant || isFavorite(favorites.data, activeId, group.kind, item.id);
                    const detail = group.kind === "live" ? (item.number ? `Ch ${item.number}` : "") : titleGroup.year ?? "";
                    return (
                      <li key={item.id} className="flex items-center gap-2 px-2 py-1">
                        <button
                          type="button"
                          data-tv-focus
                          data-zone-edge-left="true"
                          data-focus-key={group === firstResult && index === 0 ? "global-result-first" : undefined}
                           onClick={() => open(group.kind, titleGroup)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded px-1 py-1 text-left outline-none focus:bg-secondary focus:ring-2 focus:ring-primary"
                        >
                          <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded bg-muted", group.kind === "live" ? "size-9" : "h-12 w-8")}>
                            {item.image && <img src={item.image} alt="" loading="lazy" className={cn("size-full", group.kind === "live" ? "object-contain p-1" : "object-cover")} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                          </span>
                          <span className="min-w-0 flex-1">
                             <span className="block truncate text-sm font-semibold">{titleGroup.title}</span>
                            {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                          </span>
                        </button>
                         <Button type="button" size="sm" variant="secondary" data-tv-focus className="h-8 focus:ring-2 focus:ring-primary" onClick={() => open(group.kind, titleGroup)}>
                          <Play className="size-3.5 fill-current" /> {group.kind === "series" ? "Open" : "Play"}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          data-tv-focus
                          aria-label={fav ? "Remove from favourites" : "Add to favourites"}
                          className="size-8 focus:ring-2 focus:ring-primary"
                           onClick={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: group.kind, itemId: favouriteVariant?.item.id ?? item.id, title: titleGroup.title, logoUrl: item.image })}
                        >
                          <Star className={cn("size-4", fav && "fill-primary text-primary")} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : !group.loading ? <p className="text-xs text-muted-foreground">No matches.</p> : null}
            </div>
          ))}
        </div>
      )}
      <TitleDetailsDialog kind={openGroup?.kind ?? "movie"} id={openGroup?.group.item.id ?? null} name={openGroup?.group.title} image={openGroup?.group.item.image} year={openGroup?.group.year} variants={openGroup?.group.variants} onClose={() => setOpenGroup(null)} />
      <FranchiseList franchise={franchise.data ?? null} movies={movies.data} shows={shows.data} open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />
    </section>
  );
}
