import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownAZ, ArrowLeft, CalendarArrowDown, Play, Search, Sparkles, Star } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PosterGrid, PosterTile } from "@/components/media";
import { PopularRow } from "@/components/popular-row";
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
import { LayerHeading } from "@/components/layered-navigation";

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
  const toggleFavorite = useToggleFavorite();
  const saveProgress = useSaveProgress();
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<"az" | "year">("az");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [episode, setEpisode] = useState<EpisodeItem | null>(null);
  const [organising, setOrganising] = useState(false);
  const [playing, setPlaying] = useState(false);
  const categoryFocus = useRef<HTMLButtonElement>(null);
  const previousGenre = useRef<string | null>(null);
  const titleTrigger = useRef<HTMLElement | null>(null);
  const returnTitle = useRef<string | null>(null);

  const catalogue = useQuery({
    queryKey: ["system-catalogue", activeId, kind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind } }),
    enabled: !!activeId,
    staleTime: 5 * 60_000,
  });
  const names = useMemo(() => (catalogue.data ?? []).map((item) => item.name).slice(0, 5000), [catalogue.data]);
  const metadata = useQuery({
    queryKey: ["cached-title-metadata", activeId, kind, names.length],
    queryFn: () => fetchMetadata({ data: { playlistId: activeId ?? "", kind, names } }),
    enabled: !!activeId && names.length > 0,
    staleTime: 10 * 60_000,
  });

  const groups = useMemo(() => {
    const buckets = new Map<string, CatalogItem[]>();
    for (const item of catalogue.data ?? []) {
      const label = metadata.data?.[item.name]?.genres?.[0] || "Other";
      const bucket = buckets.get(label);
      if (bucket) bucket.push(item);
      else buckets.set(label, [item]);
    }
    return [...buckets.entries()]
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => a.label === "Other" ? 1 : b.label === "Other" ? -1 : a.label.localeCompare(b.label));
  }, [catalogue.data, metadata.data]);

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
  const visibleItems = useMemo(() => {
    const source = genre === "All" ? (catalogue.data ?? []) : (chosenGroup?.items ?? []);
    const filtered = source.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
    const titleOf = (item: CatalogItem) => metadata.data?.[item.name]?.title || item.name;
    return [...filtered].sort((a, b) =>
      sort === "year"
        ? (Number(metadata.data?.[b.name]?.year || b.year || 0) - Number(metadata.data?.[a.name]?.year || a.year || 0)) || titleOf(a).localeCompare(titleOf(b))
        : titleOf(a).localeCompare(titleOf(b)),
    );
  }, [genre, chosenGroup, catalogue.data, search, sort, metadata.data]);
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
  const selectedItem = (catalogue.data ?? []).find((item) => item.id === selectedId);

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
  const resumeAt = (progress.data ?? []).find((row) => row.playlistId === activeId && row.itemId === mediaId && !row.completed)?.positionSeconds ?? 0;

  const selectTitle = (id: string) => {
    titleTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnTitle.current = (catalogue.data ?? []).find((item) => item.id === id)?.name ?? null;
    setSelectedId(id);
    setSeasonIndex(0);
    setEpisode(null);
    setPlaying(false);
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
        <div className="scrollbar-thin flex min-h-0 gap-1 overflow-x-auto md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {catalogue.isLoading || metadata.isLoading ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-36 shrink-0 md:w-full" />) : (<>
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
          ))}</>)}
        </div>
      </aside>

      <div data-tv-zone="content" data-tv-zone-order="2" className="scrollbar-thin min-h-0 min-w-0 overflow-y-auto pr-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">{genre ?? "Loading categories"}</p>
          <h1 className="mt-1 truncate font-display text-xl font-bold">{`Choose ${kind === "movie" ? "a movie" : "a show"}`}</h1>
        </div>

        <div className="mt-4 min-w-0">
          <PopularRow kind={kind} tv={tv} onOpen={selectTitle} />
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-display text-lg font-semibold">{genre ?? "Titles"} <span className="text-sm font-normal text-muted-foreground">· {visibleItems.length}</span></h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <Button data-tv-focus size="sm" variant={sort === "az" ? "secondary" : "ghost"} className="rounded-none" onClick={() => setSort("az")}><ArrowDownAZ className="size-4" /> A–Z</Button>
              <Button data-tv-focus size="sm" variant={sort === "year" ? "secondary" : "ghost"} className="rounded-none" onClick={() => setSort("year")}><CalendarArrowDown className="size-4" /> Year</Button>
            </div>
            <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === "movie" ? "movies" : "shows"}`} className="pl-9" /></div>
          </div>
        </div>
        {catalogue.isError || metadata.isError ? <p className="text-sm text-destructive">Your library could not be loaded. Try again shortly.</p> : visibleItems.length === 0 && !catalogue.isLoading ? <EmptyState title="Nothing here" description="No titles match this system category." /> : sections.map((section, sectionIndex) => (
          <div key={section.label} className="mb-5">
            <h3 className="sticky top-0 z-10 mb-2 bg-background/95 py-1 font-display text-base font-semibold text-primary backdrop-blur">{section.label} <span className="text-xs font-normal text-muted-foreground">· {section.items.length}</span></h3>
            <PosterGrid>{section.items.slice(0, 180).map((item, index) => <PosterTile key={item.id} zoneEntry={sectionIndex === 0 && index === 0} title={metadata.data?.[item.name]?.title || item.name} image={metadata.data?.[item.name]?.poster || item.image} subtitle={String(metadata.data?.[item.name]?.year || item.year || "")} progress={progressFor(progress.data, activeId, item.id)} favorite={isFavorite(favorites.data, activeId, kind, item.id)} onSelect={() => selectTitle(item.id)} onToggleFavorite={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: item.id, title: item.name, logoUrl: item.image })} />)}</PosterGrid>
          </div>
        ))}
        </div>
      </div>

      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) closeDetails(); }}>
        <DialogContent onCloseAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() => {
            const trigger = titleTrigger.current;
            const replacement = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-zone="content"] [data-tv-focus]')).find((element) => element.textContent?.includes(returnTitle.current ?? "") || element.querySelector('img')?.alt === returnTitle.current);
            (trigger?.isConnected ? trigger : replacement)?.focus({ preventScroll: true });
          });
        }} data-tv-zone="details" className="max-h-[86dvh] w-[min(92vw,56rem)] max-w-none gap-0 overflow-hidden p-0 sm:rounded-lg">
          <div className="scrollbar-thin max-h-[86dvh] overflow-y-auto">
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,46%)] md:p-5">
              <div className="min-w-0">
                <DialogHeader className="pr-8 text-left">
                  <p className="text-xs font-semibold uppercase text-primary">{kind === "movie" ? "Movie" : "Show"}</p>
                  <DialogTitle className="font-display text-2xl leading-tight">{selectedMetadata?.title || selectedItem?.name || "Loading details"}</DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {detailYear && <span>{detailYear}</span>}
                    {detailGenres.map((item) => <span key={item}>{item}</span>)}
                    {selectedProgress && <span className="font-medium text-primary">Resume at {formatResume(selectedProgress.positionSeconds)}</span>}
                  </DialogDescription>
                </DialogHeader>
                {overview && <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{overview}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {kind === "movie" && !playing && (
                    <Button data-tv-focus data-zone-entry="true" onClick={() => setPlaying(true)}><Play className="size-4" />{resumeAt > 0 ? "Resume" : "Play"}</Button>
                  )}
                  {selectedId && <Button data-tv-focus variant="secondary" onClick={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: selectedId, title: selectedItem?.name ?? title ?? "", logoUrl: poster ?? null })}><Star className={cn("size-4", selectedFavorite && "fill-primary text-primary")} />{selectedFavorite ? "In favourites" : "Add to favourites"}</Button>}
                  <DialogClose asChild><Button data-dialog-back data-tv-focus variant="outline">Close</Button></DialogClose>
                </div>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {playing && mediaId ? (
                  <VideoPlayer onStop={closeDetails} src={playback.data?.url ?? null} fallbackSrc={playback.data?.directUrl ?? null} title={title ?? ""} poster={poster ?? null} startPosition={resumeAt} onProgress={(position, duration) => record(position, duration)} onExternalLaunch={() => record(resumeAt, null, true)} {...(kind === "series" ? { onEnded: playNext } : {})} />
                ) : (
                  <button
                    type="button"
                    data-tv-focus
                    data-zone-entry="true"
                    className="group relative grid h-full w-full place-items-center bg-card/80"
                    onClick={() => {
                      if (kind === "series" && !episode) {
                        const first = seasons[0]?.episodes[0];
                        if (first) { setSeasonIndex(0); setEpisode(first); }
                      }
                      setPlaying(true);
                    }}
                  >
                    {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                    <span className="relative grid size-16 place-items-center rounded-full bg-primary text-primary-foreground transition group-focus-visible:ring-2 group-focus-visible:ring-ring"><Play className="size-7 fill-current" /></span>
                    <span className="sr-only">{kind === "series" && !episode ? "Play first episode" : "Play"}</span>
                  </button>
                )}
              </div>
            </div>
            {kind === "series" && show && (
              <section className="border-t border-border p-4 md:p-5">
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{seasons.map((entry, index) => <Button key={entry.season} data-tv-focus size="sm" variant={index === seasonIndex ? "default" : "secondary"} onClick={() => { setSeasonIndex(index); setEpisode(null); setPlaying(false); }}>Season {entry.season}</Button>)}</div>
                <div className="grid gap-2 sm:grid-cols-2">{(season?.episodes ?? []).map((item) => <Button key={item.id} data-tv-focus variant={episode?.id === item.id && playing ? "default" : "outline"} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={() => { setEpisode(item); setPlaying(true); }}><Play className="size-4 shrink-0" /><span className="truncate">E{item.episode} · {item.title}</span></Button>)}</div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function formatResume(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function progressFor(rows: ReturnType<typeof useProgress>["data"], playlistId: string | null, itemId: string) {
  const row = (rows ?? []).find((entry) => entry.playlistId === playlistId && (entry.itemId === itemId || entry.seriesId === itemId) && !entry.completed);
  if (!row) return null;
  return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
}