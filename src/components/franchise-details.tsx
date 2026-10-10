import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlaylists } from "@/components/playlist-context";
import { resolveFranchise, type Franchise } from "@/lib/franchise.functions";
import { getItems } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { groupCatalogItems, mediaMatchKey, type TitleGroup } from "@/lib/title-variants";

export function useFranchiseMatches(franchise: Franchise | null | undefined, movies?: CatalogItem[], shows?: CatalogItem[]) {
  return useMemo(() => {
    if (!franchise) return [];
    const index = (items?: CatalogItem[]) => {
      const map = new Map<string, TitleGroup[]>();
      for (const group of groupCatalogItems(items ?? [])) {
        const key = mediaMatchKey(group.title.replace(/[[(]\s*(?:US|UK|CA|AU|EN|FR|DE|ES|IT)\s*[\])]/gi, ""));
        map.set(key, [...(map.get(key) ?? []), group]);
      }
      return map;
    };
    const moviesIndex = index(movies);
    const showsIndex = index(shows);
    return franchise.members.map((member) => {
      const candidates = (member.kind === "movie" ? moviesIndex : showsIndex).get(mediaMatchKey(member.title)) ?? [];
      const group = candidates.find((candidate) => {
        // Providers may supply a full release date rather than a four-digit year.
        const year = String(candidate.year ?? "").match(/\b(?:19|20)\d{2}\b/)?.[0];
        return !member.year || !year || Math.abs(Number(year) - member.year) <= 1;
      }) ?? null;
      return { member, group };
    });
  }, [franchise, movies, shows]);
}

export function FranchiseDetails({ title, kind, onSelect }: {
  title: string; kind: "movie" | "series";
  onSelect: (kind: "movie" | "series", group: TitleGroup) => void;
}) {
  const { activeId } = usePlaylists();
  const lookup = useServerFn(resolveFranchise);
  const fetchItems = useServerFn(getItems);
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState<"year" | "story">("year");
  const franchise = useQuery({
    queryKey: ["franchise", title, kind],
    queryFn: () => lookup({ data: { title, kind } }),
    enabled: !!title,
    staleTime: Infinity,
  });
  const catalogueOptions = (itemKind: "movie" | "series") => ({
    queryKey: ["system-catalogue", activeId, itemKind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind: itemKind } }),
    enabled: expanded && !!activeId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  const movies = useQuery(catalogueOptions("movie"));
  const shows = useQuery(catalogueOptions("series"));
  const matches = useFranchiseMatches(franchise.data, movies.data, shows.data);
  const loading = (movies.isPending || shows.isPending) && !!activeId;
  const sorted = [...matches].sort((a, b) => order === "story"
    ? a.member.story_index - b.member.story_index
    : (a.member.year ?? 9999) - (b.member.year ?? 9999));

  if (franchise.isPending) return <p role="status" className="mt-4 text-xs text-muted-foreground">Finding related movies and shows…</p>;
  if (franchise.isError) return <Button data-tv-focus variant="outline" size="sm" className="mt-4" onClick={() => void franchise.refetch()}>Retry related titles</Button>;
  if (!franchise.data) return null;

  return (
    <section className="mt-4 border-t border-border pt-3">
      <Button data-tv-focus variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <Layers className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">Part of {franchise.data.name}</span>
        {expanded ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </Button>
      {expanded && <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">{loading ? "Checking your library…" : `${matches.filter(({ group }) => group).length} of ${matches.length} titles in your library`}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Franchise order">
          <Button data-tv-focus size="sm" variant={order === "year" ? "default" : "secondary"} aria-pressed={order === "year"} onClick={() => setOrder("year")}>By year</Button>
          {franchise.data.hasStoryOrder && <Button data-tv-focus size="sm" variant={order === "story" ? "default" : "secondary"} aria-pressed={order === "story"} onClick={() => setOrder("story")}>Story order</Button>}
        </div>
        {(movies.isError || shows.isError) && <Button data-tv-focus variant="outline" size="sm" onClick={() => { void movies.refetch(); void shows.refetch(); }}>Retry library check</Button>}
        <ul className="space-y-1 p-1">
          {sorted.map(({ member, group }, index) => <li key={`${member.kind}-${member.title}-${member.year}`}>
            <Button data-tv-focus variant="ghost" disabled={!group} onClick={() => group && onSelect(member.kind, group)} className="h-auto w-full justify-start gap-2 whitespace-normal px-2 py-2 text-left">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{member.title}</span>
                <span className="block text-xs text-muted-foreground">{member.year ?? "—"} · {member.kind === "movie" ? "Movie" : "Show"}{!group && !loading && ` · ${movies.isError || shows.isError ? "Library unavailable" : "Not in your list"}`}</span>
              </span>
            </Button>
          </li>)}
        </ul>
      </div>}
    </section>
  );
}