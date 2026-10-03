import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clapperboard, MonitorPlay, Play, Search, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PosterGrid, PosterTile } from "@/components/media";
import { PopularRow } from "@/components/popular-row";
import { VideoPlayer } from "@/components/video-player";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
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
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [episode, setEpisode] = useState<EpisodeItem | null>(null);
  const [organising, setOrganising] = useState(false);
  const categoryFocus = useRef<HTMLButtonElement>(null);
  const previousGenre = useRef<string | null>(null);

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
  }, [activeId, kind]);

  useEffect(() => {
    if (genre === null && groups.length > 0) setGenre(groups[0]?.label ?? null);
  }, [genre, groups]);

  const chosenGroup = groups.find((group) => group.label === genre);
  const visibleItems = (chosenGroup?.items ?? []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
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
    enabled: !!activeId && !!mediaId && (kind === "series" || !!movie.data),
    staleTime: 60_000,
  });

  const show = series.data;
  const seasons = show?.seasons ?? [];
  const season = seasons[seasonIndex];
  const title = kind === "movie" ? movie.data?.name ?? selectedItem?.name : episode ? `${show?.name ?? ""} — S${episode.season} E${episode.episode}` : show?.name ?? selectedItem?.name;
  const poster = kind === "movie" ? movie.data?.image ?? selectedItem?.image : episode?.image ?? show?.image ?? selectedItem?.image;
  const resumeAt = (progress.data ?? []).find((row) => row.playlistId === activeId && row.itemId === mediaId && !row.completed)?.positionSeconds ?? 0;

  const selectTitle = (id: string) => {
    setSelectedId(id);
    setSeasonIndex(0);
    setEpisode(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const returnToSections = () => void navigate({ to: tv ? "/tv" : "/dashboard" });
  const chooseGenre = (label: string) => {
    if (label === genre) return;
    previousGenre.current = genre;
    setGenre(label);
    setSelectedId(null);
    setEpisode(null);
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
          {catalogue.isLoading || metadata.isLoading ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-36 shrink-0 md:w-full" />) : groups.map((group, index) => (
            <Button
              key={group.label}
              ref={index === 0 ? categoryFocus : undefined}
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
        </div>
      </aside>

      <div data-tv-zone="content" data-tv-zone-order="2" className="scrollbar-thin min-h-0 min-w-0 overflow-y-auto pr-1">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,38%)]">
          <div className="min-w-0 self-center lg:order-1">
            <p className="text-xs font-semibold uppercase text-primary">{genre ?? "Loading categories"}</p>
            <h1 className="mt-1 truncate font-display text-xl font-bold">{title ?? `Choose ${kind === "movie" ? "a movie" : "a show"}`}</h1>
            {kind === "series" && show?.plot && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{show.plot}</p>}
          </div>
          <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-lg bg-muted lg:order-2">
            <VideoPlayer src={playback.data?.url ?? null} fallbackSrc={playback.data?.directUrl ?? null} title={title ?? ""} poster={poster ?? null} startPosition={resumeAt} onProgress={(position, duration) => record(position, duration)} onExternalLaunch={() => record(resumeAt, null, true)} {...(kind === "series" ? { onEnded: playNext } : {})} />
            {!mediaId && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 px-4 text-center"><div>{kind === "movie" ? <Clapperboard className="mx-auto size-7 text-primary" /> : <MonitorPlay className="mx-auto size-7 text-primary" />}<p className="mt-2 font-display text-base font-semibold">Choose {kind === "movie" ? "a movie" : "a show"}</p><p className="mt-1 text-xs text-muted-foreground">Your selection will play here.</p></div></div>}
          </div>
        </div>

        <div className="mt-4 min-w-0">
          <PopularRow kind={kind} tv={tv} onOpen={selectTitle} />
        {kind === "series" && show && (
          <section className="mb-4 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">{seasons.map((entry, index) => <Button key={entry.season} data-tv-focus size="sm" variant={index === seasonIndex ? "default" : "secondary"} onClick={() => { setSeasonIndex(index); setEpisode(null); }}>Season {entry.season}</Button>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">{(season?.episodes ?? []).map((item) => <Button key={item.id} data-tv-focus variant={episode?.id === item.id ? "default" : "outline"} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={() => setEpisode(item)}><Play className="size-4 shrink-0" /><span className="truncate">E{item.episode} · {item.title}</span></Button>)}</div>
          </section>
        )}
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-display text-lg font-semibold">{genre ?? "Titles"} <span className="text-sm font-normal text-muted-foreground">· {visibleItems.length}</span></h2>
          <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === "movie" ? "movies" : "shows"}`} className="pl-9" /></div>
        </div>
        {catalogue.isError || metadata.isError ? <p className="text-sm text-destructive">Your library could not be loaded. Try again shortly.</p> : visibleItems.length === 0 && !catalogue.isLoading ? <EmptyState title="Nothing here" description="No titles match this system category." /> : <PosterGrid>{visibleItems.slice(0, 180).map((item) => <PosterTile key={item.id} title={metadata.data?.[item.name]?.title || item.name} image={metadata.data?.[item.name]?.poster || item.image} subtitle={String(metadata.data?.[item.name]?.year || item.year || "")} progress={progressFor(progress.data, activeId, item.id)} favorite={isFavorite(favorites.data, activeId, kind, item.id)} onSelect={() => selectTitle(item.id)} onToggleFavorite={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: item.id, title: item.name, logoUrl: item.image })} />)}</PosterGrid>}
        </div>
      </div>
    </section>
  );
}

function progressFor(rows: ReturnType<typeof useProgress>["data"], playlistId: string | null, itemId: string) {
  const row = (rows ?? []).find((entry) => entry.playlistId === playlistId && (entry.itemId === itemId || entry.seriesId === itemId) && !entry.completed);
  if (!row) return null;
  return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
}