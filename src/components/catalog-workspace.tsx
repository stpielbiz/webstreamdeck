import { findResume, useSyncPlaylists } from "@/lib/playlist-sync";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownAZ, ArrowLeft, CalendarArrowDown, Play, Search, Sparkles, Star } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "sonner";

import { EmptyState, PosterGrid, PosterTile } from "@/components/media";
import { CatalogGridLoading } from "@/components/catalog-loading";
import { PopularRow } from "@/components/popular-row";
import { Top10Row, type Top10Service } from "@/components/top10-rows";
import { Flame, Trophy } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getItems, getMovie, getPlayback, getSeries } from "@/lib/iptv.functions";
import type { CatalogItem, EpisodeItem } from "@/lib/iptv-types";
import { isFavorite, useFavorites, useProgress, useSaveProgress, useToggleFavorite } from "@/lib/library-hooks";
import { enrichTitles, getCachedTitleMetadata } from "@/lib/metadata.functions";
import type { TitleMetadata } from "@/lib/metadata.server";
import { useIsAdmin } from "@/lib/use-admin";
import { cn } from "@/lib/utils";
import { useVoiceSearch } from "@/lib/voice-search";
import { VoiceButton } from "@/components/voice-button";
import { LayerHeading } from "@/components/layered-navigation";
import { TitleDetailsDialog } from "@/components/title-details-dialog";
import { groupCatalogItems, mediaMatchKey, type TitleGroup, type TitleVariant } from "@/lib/title-variants";

type Kind = "movie" | "series";

export function CatalogWorkspace({ kind, tv = false }: { kind: Kind; tv?: boolean }) {
  const { activeId, playlists } = usePlaylists();
  const navigate = useNavigate();
  const fetchItems = useServerFn(getItems);
  const fetchMovie = useServerFn(getMovie);
  const fetchSeries = useServerFn(getSeries);
  const fetchPlayback = useServerFn(getPlayback);
  const fetchMetadata = useServerFn(getCachedTitleMetadata);
  const organise = useServerFn(enrichTitles);
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const favorites = useFavorites();
  const progress = useProgress();
  const syncPlaylists = useSyncPlaylists();
  const toggleFavorite = useToggleFavorite();
  const saveProgress = useSaveProgress();
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<"az" | "year">("year");
  const [search, setSearch] = useState("");
  const [limits, setLimits] = useState<Record<string, number>>({});
  const limitFor = (label: string) => limits[label] ?? 180;
  useVoiceSearch((spoken) => {
    setSearch(spoken);
    setSelectedId(null);
    document.querySelector<HTMLElement>('[data-focus-key="catalog-search"]')?.focus();
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<TitleVariant[]>([]);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [episode, setEpisode] = useState<EpisodeItem | null>(null);
  const [organising, setOrganising] = useState(false);
  const [playing, setPlaying] = useState(false);
  const categoryFocus = useRef<HTMLButtonElement>(null);
  const previousGenre = useRef<string | null>(null);
  const titleTrigger = useRef<HTMLElement | null>(null);
  const returnTitle = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const categoryContentRef = useRef<HTMLDivElement>(null);
  const [featured, setFeatured] = useState<"popular" | Top10Service>("popular");
  const goToPopular = () => {
    setFeatured("popular");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focus-key="popular-0"]')?.focus({ preventScroll: true }));
  };
  const goToTop10 = (service: Top10Service) => {
    setFeatured(service);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>(`[data-focus-key="top10-${service}-0"]`);
      if (first) first.focus({ preventScroll: true });
      else toast(`None of today's ${service === "netflix" ? "Netflix" : "Prime Video"} top 10 are in your playlist.`);
    });
  };

  const catalogue = useQuery({
    queryKey: ["system-catalogue", activeId, kind],
    queryFn: async () => {
      // Large libraries are saved on-device by the library cache (IndexedDB);
      // clear the old size-limited browser copy.
      dropCache(`catalogue:${activeId}:${kind}`);
      return fetchItems({ data: { playlistId: activeId ?? "", kind } });
    },
    enabled: !!activeId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  const names = useMemo(() => (catalogue.data ?? []).map((item) => item.name), [catalogue.data]);
  const metadata = useQuery({
    queryKey: ["cached-title-metadata", activeId, kind, names.length],
    queryFn: async () => {
      dropCache(`metadata:${activeId}:${kind}`);
      const out: Awaited<ReturnType<typeof fetchMetadata>> = {};
      for (let i = 0; i < names.length; i += 5000) {
        Object.assign(out, await fetchMetadata({ data: { playlistId: activeId ?? "", kind, names: names.slice(i, i + 5000) } }));
      }
      return out;
    },
    placeholderData: (previous) => previous,
    enabled: !!activeId && names.length > 0,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const titleGroups = useMemo(() => groupCatalogItems(catalogue.data ?? [], metadata.data), [catalogue.data, metadata.data]);
  const groupedItems = useMemo(() => titleGroups.map((group) => group.item), [titleGroups]);
  const groupByItemId = useMemo(() => {
    const map = new Map<string, TitleGroup>();
    for (const group of titleGroups) for (const variant of group.variants) map.set(variant.item.id, group);
    return map;
  }, [titleGroups]);
  const groups = useMemo(() => {
    const buckets = new Map<string, CatalogItem[]>();
    for (const item of groupedItems) {
      const label = metadata.data?.[item.name]?.genres?.[0] || "Other";
      const bucket = buckets.get(label);
      if (bucket) bucket.push(item);
      else buckets.set(label, [item]);
    }
    return [...buckets.entries()]
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => a.label === "Other" ? 1 : b.label === "Other" ? -1 : a.label.localeCompare(b.label));
  }, [groupedItems, metadata.data]);

  useEffect(() => {
    setGenre(null);
    setSelectedId(null);
    setEpisode(null);
    setPlaying(false);
  }, [activeId, kind]);

  useEffect(() => {
    if (genre === null && (catalogue.data ?? []).length > 0) setGenre("All");
  }, [genre, catalogue.data]);

  const chosenGroup = groups.find((group) => group.label === genre);
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  const visibleItems = useMemo(() => {
    const source = searching || genre === "All" ? groupedItems : (chosenGroup?.items ?? []);
    const filtered = searching
      ? source.filter((item) => {
          const meta = metadata.data?.[item.name];
          const group = groupByItemId.get(item.id);
          return item.name.toLowerCase().includes(query)
            || (group?.variants ?? []).some((variant) => variant.item.name.toLowerCase().includes(query))
            || (meta?.title ?? "").toLowerCase().includes(query)
            || (query.length >= 3 && (meta?.cast ?? []).some((actor) => actor.toLowerCase().includes(query)));
        })
      : source;
    const titleOf = (item: CatalogItem) => metadata.data?.[item.name]?.title || item.name;
    return [...filtered].sort((a, b) =>
      sort === "year"
        ? (Number(metadata.data?.[b.name]?.year || b.year || 0) - Number(metadata.data?.[a.name]?.year || a.year || 0)) || titleOf(a).localeCompare(titleOf(b))
        : titleOf(a).localeCompare(titleOf(b)),
    );
  }, [genre, chosenGroup, groupedItems, groupByItemId, query, searching, sort, metadata.data]);
  const featuredOrigin = useRef<HTMLElement | null>(null);
  const enterFeatured = (event: ReactKeyboardEvent<HTMLElement>, choice: "popular" | Top10Service) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    featuredOrigin.current = event.currentTarget;
    setFeatured(choice);
    let tries = 0;
    const attempt = () => {
      const row = document.querySelector<HTMLElement>("[data-featured-row]");
      const first = row?.querySelector<HTMLElement>("[data-tv-focus]:not([disabled])");
      if (first) { first.focus(); first.scrollIntoView({ block: "nearest", inline: "nearest" }); return; }
      if (++tries < 30) window.setTimeout(attempt, 100);
    };
    window.requestAnimationFrame(attempt);
  };
  const leaveFeatured = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" || !featuredOrigin.current?.isConnected) return;
    const row = event.currentTarget;
    const tiles = [...row.querySelectorAll<HTMLElement>("[data-tv-focus]")];
    const target = event.target as HTMLElement;
    const current = tiles.find((tile) => tile === target || tile.contains(target));
    if (!current || current.getBoundingClientRect().left - 4 > Math.min(...tiles.map((t) => t.getBoundingClientRect().left))) return;
    event.preventDefault();
    event.stopPropagation();
    featuredOrigin.current.focus();
  };
  useEffect(() => { setLimits({}); }, [genre, search, sort, activeId, kind]);
  const sections = useMemo(() => {
    const buckets = new Map<string, CatalogItem[]>();
    for (const item of visibleItems) {
      let label: string;
      if (sort === "year") {
        const year = Number(metadata.data?.[item.name]?.year || item.year || 0);
        label = year > 0 ? String(year) : "Unknown year";
      } else {
        const letter = (metadata.data?.[item.name]?.title || item.name).trim().charAt(0).toUpperCase();
        label = /[A-Z]/.test(letter) ? letter : "#";
      }
      const bucket = buckets.get(label);
      if (bucket) bucket.push(item);
      else buckets.set(label, [item]);
    }
    return [...buckets.entries()].map(([label, items]) => ({ label, items }));
  }, [visibleItems, sort, metadata.data]);
  const selectedGroup = selectedId ? groupByItemId.get(selectedId) : undefined;
  const selectedItem = selectedGroup?.item ?? groupedItems.find((item) => item.id === selectedId);

  const movie = useQuery({
    queryKey: ["movie", activeId, selectedId],
    queryFn: () => fetchMovie({ data: { playlistId: activeId ?? "", id: selectedId ?? "" } }),
    enabled: !!activeId && kind === "movie" && !!selectedId,
    staleTime: 10 * 60_000,
  });
  const series = useQuery({
    queryKey: ["series", activeId, selectedId],
    queryFn: () => fetchSeries({ data: { playlistId: activeId ?? "", id: selectedId ?? "" } }),
    enabled: !!activeId && kind === "series" && !!selectedId,
    staleTime: 10 * 60_000,
  });
  const mediaId = kind === "movie" ? selectedId : episode?.id ?? null;
  const mediaExt = kind === "movie" ? movie.data?.ext : episode?.ext;
  const playback = useQuery({
    queryKey: ["playback", activeId, kind, mediaId, mediaExt],
    queryFn: () => fetchPlayback({ data: { playlistId: activeId ?? "", kind: kind === "movie" ? "movie" : "episode", itemId: mediaId ?? "", ext: mediaExt ?? null } }),
    enabled: playing && !!activeId && !!mediaId && (kind === "series" || !!movie.data),
    staleTime: 60_000,
  });

  const show = series.data;
  const seasons = show?.seasons ?? [];
  const season = seasons[seasonIndex];
  const title = kind === "movie" ? movie.data?.name ?? selectedItem?.name : episode ? `${show?.name ?? ""} — S${episode.season} E${episode.episode}` : show?.name ?? selectedItem?.name;
  const poster = kind === "movie" ? movie.data?.image ?? selectedItem?.image : episode?.image ?? show?.image ?? selectedItem?.image;
  const selectedMetadata = selectedItem ? metadata.data?.[selectedItem.name] : undefined;
  const details = kind === "movie" ? movie.data : show;
  const overview = details?.plot || selectedMetadata?.overview;
  const detailGenres = selectedMetadata?.genres?.length ? selectedMetadata.genres : details?.genre ? [details.genre] : [];
  const detailYear = selectedMetadata?.year || selectedItem?.year;
  const selectedProgress = (progress.data ?? []).find((row) => row.playlistId === activeId && (row.itemId === selectedId || row.seriesId === selectedId) && !row.completed);
  const selectedFavorite = selectedId ? isFavorite(favorites.data, activeId, kind, selectedId) : false;
  const resumeRow = mediaId ? findResume(progress.data, activeId, { itemId: mediaId, title, season: kind === "movie" ? null : episode?.season, episode: kind === "movie" ? null : episode?.episode }, syncPlaylists) : undefined;
  const resumeAt = resumeRow && !resumeRow.completed ? resumeRow.positionSeconds : 0;

  const selectTitle = (id: string, trigger?: HTMLElement | null, variants?: TitleVariant[]) => {
    titleTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const group = groupByItemId.get(id);
    returnTitle.current = group?.title ?? groupedItems.find((item) => item.id === id)?.name ?? null;
    const available = variants?.length ? variants : group?.variants ?? [];
    setSelectedVariants(available);
    setSelectedId(available[0]?.item.id ?? id);
    setSeasonIndex(0);
    setEpisode(null);
    setPlaying(false);
    setSelectedVariants([]);
  };
  const closeDetails = () => {
    setSelectedId(null);
    setEpisode(null);
    setPlaying(false);
  };
  const returnToSections = () => void navigate({ to: tv ? "/tv" : "/dashboard" });
  const chooseGenre = (label: string) => {
    if (label === genre) return;
    previousGenre.current = genre;
    setGenre(label);
    setSelectedId(null);
    setEpisode(null);
    setPlaying(false);
    setSearch("");
    window.requestAnimationFrame(() => {
      const content = contentRef.current;
      const categoryContent = categoryContentRef.current;
      if (!content || !categoryContent) return;
      content.scrollTo({ top: Math.max(0, categoryContent.offsetTop - 8), behavior: "auto" });
    });
  };
  const playNext = () => {
    if (!episode || !season) return;
    const index = season.episodes.findIndex((item) => item.id === episode.id);
    const next = season.episodes[index + 1] ?? seasons[seasonIndex + 1]?.episodes[0];
    if (!next) return;
    if (!season.episodes[index + 1]) setSeasonIndex((value) => value + 1);
    setEpisode(next);
  };
  const record = (positionSeconds: number, durationSeconds?: number | null, external = false) => {
    if (!activeId || !mediaId || !title) return;
    void saveProgress({
      playlistId: activeId,
      itemKind: kind === "movie" ? "movie" : "episode",
      itemId: mediaId,
      seriesId: kind === "series" ? selectedId : null,
      season: episode?.season ?? null,
      episode: episode?.episode ?? null,
      title,
      posterUrl: poster ?? null,
      positionSeconds,
      durationSeconds: durationSeconds ?? null,
      external,
    });
  };
  const organiseMissing = async () => {
    if (!activeId) return;
    const missing = names.filter((name) => !metadata.data?.[name]).slice(0, 600);
    if (missing.length === 0) {
      toast.success("All visible titles are organised");
      return;
    }
    setOrganising(true);
    try {
      for (let index = 0; index < missing.length; index += 60) {
        await organise({ data: { playlistId: activeId, kind, names: missing.slice(index, index + 60) } });
      }
      await queryClient.invalidateQueries({ queryKey: ["cached-title-metadata", activeId, kind] });
      toast.success("System categories updated");
    } catch {
      toast.error("Some titles could not be organised");
    } finally {
      setOrganising(false);
    }
  };

  if (playlists.length === 0) return <div className="p-6"><EmptyState title="No playlist yet" description="Add an Xtream login or M3U link and your library appears here." /></div>;

  return (
    <section
      data-tv-zone-group="catalog"
      className={cn(
        "grid h-[calc(100dvh-4.5rem)] min-h-0 min-w-0 animate-slide-in-right grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 motion-reduce:animate-none md:grid-cols-[minmax(10rem,20%)_minmax(0,80%)] md:grid-rows-1 sm:p-4",
        tv && "h-[calc(100dvh-5.25rem)] p-0 sm:p-0",
      )}
    >
      <aside data-tv-zone="categories" data-tv-zone-order="1" className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <Button data-layer-back data-tv-focus variant="ghost" className="mb-2 shrink-0 justify-start px-2" onClick={returnToSections}><ArrowLeft className="size-4" /> Sections</Button>
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <LayerHeading title={kind === "movie" ? "Movies" : "Shows"} subtitle="System categories" />
          {isAdmin && <Button data-tv-focus size="icon" variant="ghost" title="Organise missing titles" disabled={organising} onClick={() => void organiseMissing()}><Sparkles className={cn("size-4", organising && "animate-pulse")} /></Button>}
        </div>
        <div className="scrollbar-thin flex min-h-0 gap-1 overflow-x-auto p-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {catalogue.isLoading ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-36 shrink-0 md:w-full" />) : (<>
            <Button
              data-tv-focus
              data-focus-key="category-popular"
              variant={featured === "popular" ? "secondary" : "ghost"}
              className="h-10 w-40 shrink-0 justify-start gap-2 px-3 text-left text-sm text-primary md:w-full"
              onClick={goToPopular}
              onKeyDown={(event) => enterFeatured(event, "popular")}
            >
              <Flame className="size-4" /> Popular here
            </Button>
            {(["netflix", "prime"] as const).map((service) => (
              <Button
                key={service}
                data-tv-focus
                data-focus-key={`category-top10-${service}`}
                variant={featured === service ? "secondary" : "ghost"}
                className="h-10 w-40 shrink-0 justify-start gap-2 px-3 text-left text-sm text-primary md:w-full"
                onClick={() => goToTop10(service)}
                onKeyDown={(event) => enterFeatured(event, service)}
              >
                <Trophy className="size-4" /> Top 10 {service === "netflix" ? "Netflix" : "Prime"}
              </Button>
            ))}
            <Button
              ref={categoryFocus}
              data-tv-focus
              data-zone-entry={genre === "All" ? "true" : undefined}
              data-focus-key="category-All"
              variant={genre === "All" ? "secondary" : "ghost"}
              className="h-10 w-40 shrink-0 justify-between px-3 text-left text-sm md:w-full"
              onFocus={() => chooseGenre("All")}
              onClick={() => chooseGenre("All")}
            >
              <span className="truncate">All</span><span className="ml-2 text-xs text-muted-foreground">{(catalogue.data ?? []).length}</span>
            </Button>
            {groups.map((group) => (
            <Button
              key={group.label}
              data-tv-focus
              data-zone-entry={group.label === genre ? "true" : undefined}
              data-focus-key={`category-${group.label}`}
              variant={group.label === genre ? "secondary" : "ghost"}
              className="h-10 w-40 shrink-0 justify-between px-3 text-left text-sm md:w-full"
              onFocus={() => chooseGenre(group.label)}
              onClick={() => chooseGenre(group.label)}
            >
              <span className="truncate">{group.label}</span><span className="ml-2 text-xs text-muted-foreground">{group.items.length}</span>
            </Button>
          ))}
            {metadata.isLoading && !metadata.data && Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-36 shrink-0 md:w-full" />)}</>)}
        </div>
      </aside>

      <div ref={contentRef} data-tv-zone="content" data-tv-zone-order="2" className="scrollbar-thin min-h-0 min-w-0 overflow-y-auto pr-1">
        <div data-featured-row onKeyDown={leaveFeatured}>
        {featured === "popular" ? (
          <PopularRow kind={kind} tv={tv} items={catalogue.data ?? []} metadata={metadata.data} onOpen={selectTitle} />
        ) : (
            <Top10Row kind={kind} tv={tv} items={catalogue.data ?? []} metadata={metadata.data} service={featured} onOpen={selectTitle} />
        )}
        </div>
        <div ref={categoryContentRef} className="min-w-0 scroll-mt-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">{genre ?? "Loading categories"}{catalogue.isFetching && catalogue.data && <span className="animate-pulse font-normal normal-case text-muted-foreground">Updating library…</span>}</p>
          <h1 className="mt-1 truncate font-display text-xl font-bold">{`Choose ${kind === "movie" ? "a movie" : "a show"}`}</h1>
        </div>

        <div className="mt-4 min-w-0">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-display text-lg font-semibold">{searching ? `Results for “${search.trim()}”` : genre ?? "Titles"} <span className="text-sm font-normal text-muted-foreground">· {visibleItems.length}</span></h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <Button data-tv-focus size="sm" data-focus-key="sort-az" variant={sort === "az" ? "secondary" : "ghost"} className="rounded-none" onClick={() => setSort("az")}><ArrowDownAZ className="size-4" /> A–Z</Button>
              <Button data-tv-focus size="sm" data-focus-key="sort-year" variant={sort === "year" ? "secondary" : "ghost"} className="rounded-none" onClick={() => setSort("year")}><CalendarArrowDown className="size-4" /> Newest</Button>
            </div>
            <VoiceButton focusKey="catalog-voice" /><div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input data-tv-focus data-focus-key="catalog-search" type="search" onKeyDown={(event) => { if (event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); document.querySelector<HTMLElement>('[data-tv-zone="content"] [data-zone-entry="true"]')?.focus(); } }} value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }} placeholder={`Search all ${kind === "movie" ? "movies" : "shows"}`} className="pl-9" /></div>
          </div>
        </div>
        {catalogue.isLoading && !catalogue.data ? <CatalogGridLoading title={kind === "movie" ? "Movies" : "Shows"} /> : catalogue.isError || metadata.isError ? <p className="text-sm text-destructive">Your library could not be loaded. Try again shortly.</p> : visibleItems.length === 0 ? <EmptyState title="Nothing here" description={searching ? `No titles match “${search.trim()}”.` : "No titles match this system category."} /> : sections.map((section, sectionIndex) => (
          <div key={section.label} className="mb-5">
            <h3 className="sticky top-0 z-10 mb-2 bg-background/95 py-1 font-display text-base font-semibold text-primary backdrop-blur">{section.label} <span className="text-xs font-normal text-muted-foreground">· {section.items.length}</span></h3>
            <PosterGrid>{section.items.slice(0, limitFor(section.label)).map((item, index) => { const titleGroup = groupByItemId.get(item.id); const variants = titleGroup?.variants ?? []; const favouriteVariant = variants.find((variant) => isFavorite(favorites.data, activeId, kind, variant.item.id)); return <PosterTile key={item.id} zoneEntry={sectionIndex === 0 && index === 0} title={titleGroup?.title || metadata.data?.[item.name]?.title || item.name} image={metadata.data?.[item.name]?.poster || item.image} subtitle={String(titleGroup?.year || metadata.data?.[item.name]?.year || item.year || "")} progress={progressForVariants(progress.data, activeId, variants, titleGroup?.title)} favorite={!!favouriteVariant} onSelect={() => selectTitle(item.id)} onToggleFavorite={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: favouriteVariant?.item.id ?? item.id, title: titleGroup?.title ?? item.name, logoUrl: item.image })} />; })}{section.items.length > limitFor(section.label) && <button type="button" data-tv-focus data-focus-key={`show-more-${section.label}`} onClick={(event) => { const label = section.label; const at = limitFor(label); setLimits((prev) => ({ ...prev, [label]: at + 180 })); const grid = event.currentTarget.parentElement; window.requestAnimationFrame(() => (grid?.children[at] as HTMLElement | undefined)?.querySelector<HTMLElement>("[data-tv-focus]")?.focus()); }} className="flex aspect-[2/3] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-2 text-center text-sm font-semibold text-muted-foreground transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">Show more<span className="mt-1 text-xs font-normal">{(section.items.length - limitFor(section.label)).toLocaleString()} left</span></button>}</PosterGrid>
          </div>
        ))}
        </div>
      </div>

      <TitleDetailsDialog
        kind={kind}
        id={selectedId}
        name={selectedGroup?.title ?? selectedItem?.name}
        image={selectedItem?.image}
        year={selectedGroup?.year ?? selectedItem?.year}
        metadata={selectedMetadata}
        variants={selectedVariants}
        onClose={closeDetails}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() => {
            const trigger = titleTrigger.current;
            const replacement = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-zone="content"] [data-tv-focus]')).find((element) => element.textContent?.includes(returnTitle.current ?? "") || element.querySelector('img')?.alt === returnTitle.current);
            (trigger?.isConnected ? trigger : replacement)?.focus({ preventScroll: true });
          });
        }}
      />
    </section>
  );
}

function formatResume(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function progressForVariants(rows: ReturnType<typeof useProgress>["data"], playlistId: string | null, variants: TitleVariant[], title?: string) {
  const ids = new Set(variants.map((variant) => variant.item.id));
  const row = (rows ?? []).find((entry) => entry.playlistId === playlistId && (ids.has(entry.itemId) || (entry.seriesId ? ids.has(entry.seriesId) : false) || (!!title && mediaMatchKey(entry.title) === mediaMatchKey(title))) && !entry.completed);
  if (!row) return null;
  return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
}
const CACHE_PREFIX = "streamdeck-cache:";
function readCache<T = unknown>(key: string): { at: number; data: T } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as { at: number; data: T }) : undefined;
  } catch {
    return undefined;
  }
}
function dropCache(key: string) {
  try { window.localStorage.removeItem(CACHE_PREFIX + key); } catch { /* ignore */ }
}

function writeCache(key: string, data: unknown) {
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full — skip */
  }
}
