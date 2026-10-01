import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, MonitorPlay, Play, Search, Sparkles } from "lucide-react";
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

type Kind = "movie" | "series";

export function CatalogWorkspace({ kind, tv = false }: { kind: Kind; tv?: boolean }) {
  const { activeId, playlists } = usePlaylists();
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
    if (genre === null && groups.length > 0) setGenre(groups[0]?.label ?? "Other");
  }, [genre, groups]);
  useEffect(() => {
    setGenre(null);
    setSelectedId(null);
    setEpisode(null);
  }, [activeId, kind]);

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
      durationSeconds,
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
    <section className={cn("grid min-w-0 gap-5 p-3 sm:p-5 lg:grid-cols-[13rem_minmax(0,1fr)]", tv && "p-0 lg:grid-cols-[15rem_minmax(0,1fr)]")}>
      <aside className="order-2 min-w-0 lg:order-1 lg:row-span-2">
        <div className="lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className={cn("font-display font-bold", tv ? "text-2xl" : "text-xl")}>{kind === "movie" ? "Movies" : "Shows"}</h1>
            {isAdmin && <Button data-tv-focus size="icon" variant="ghost" title="Organise missing titles" disabled={organising} onClick={() => void organiseMissing()}><Sparkles className={cn("size-4", organising && "animate-pulse")} /></Button>}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">System categories</p>
          <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2 lg:max-h-[calc(100vh-10rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
            {catalogue.isLoading || metadata.isLoading ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-11 w-36 shrink-0 lg:w-full" />) : groups.map((group, index) => (
              <Button key={group.label} ref={index === 0 ? categoryFocus : undefined} data-tv-focus variant={genre === group.label ? "default" : "secondary"} className="h-11 w-36 shrink-0 justify-between gap-2 px-3 lg:w-full" onClick={() => { setGenre(group.label); setSearch(""); }}>
                <span className="truncate">{group.label}</span><span className="text-xs opacity-70">{group.items.length}</span>
              </Button>
            ))}
          </div>
        </div>
      </aside>

      <div className="order-1 min-w-0 lg:order-2">
        <div className="relative overflow-hidden rounded-lg bg-muted">
          <VideoPlayer src={playback.data?.url ?? null} fallbackSrc={playback.data?.directUrl ?? null} title={title ?? ""} poster={poster ?? null} startPosition={resumeAt} onProgress={(position, duration) => record(position, duration)} onExternalLaunch={() => record(resumeAt, null, true)} {...(kind === "series" ? { onEnded: playNext } : {})} />
          {!mediaId && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 px-6 text-center"><div>{kind === "movie" ? <Clapperboard className="mx-auto size-9 text-primary" /> : <MonitorPlay className="mx-auto size-9 text-primary" />}<p className="mt-3 font-display text-lg font-semibold">Choose {kind === "movie" ? "a movie" : "a show"}</p><p className="mt-1 text-sm text-muted-foreground">Your selection will play here.</p></div></div>}
        </div>
        {title && <div className="mt-3"><h2 className="font-display text-lg font-semibold">{title}</h2>{kind === "series" && show?.plot && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{show.plot}</p>}</div>}
      </div>

      <div className="order-3 min-w-0 lg:order-3 lg:col-start-2">
        <PopularRow kind={kind} tv={tv} onOpen={selectTitle} />
        {kind === "series" && show && (
          <section className="mb-6 space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">{seasons.map((entry, index) => <Button key={entry.season} data-tv-focus size="sm" variant={index === seasonIndex ? "default" : "secondary"} onClick={() => { setSeasonIndex(index); setEpisode(null); }}>Season {entry.season}</Button>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">{(season?.episodes ?? []).map((item) => <Button key={item.id} data-tv-focus variant={episode?.id === item.id ? "default" : "outline"} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={() => setEpisode(item)}><Play className="size-4 shrink-0" /><span className="truncate">E{item.episode} · {item.title}</span></Button>)}</div>
          </section>
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{genre ?? "Titles"} <span className="text-sm font-normal text-muted-foreground">· {visibleItems.length}</span></h2>
          <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === "movie" ? "movies" : "shows"}`} className="pl-9" /></div>
        </div>
        {catalogue.isError || metadata.isError ? <p className="text-sm text-destructive">Your library could not be loaded. Try again shortly.</p> : visibleItems.length === 0 && !catalogue.isLoading ? <EmptyState title="Nothing here" description="No titles match this system category." /> : <PosterGrid>{visibleItems.slice(0, 180).map((item) => <PosterTile key={item.id} title={metadata.data?.[item.name]?.title || item.name} image={metadata.data?.[item.name]?.poster || item.image} subtitle={String(metadata.data?.[item.name]?.year || item.year || "")} progress={progressFor(progress.data, activeId, item.id)} favorite={isFavorite(favorites.data, activeId, kind, item.id)} onSelect={() => selectTitle(item.id)} onToggleFavorite={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: item.id, title: item.name, logoUrl: item.image })} />)}</PosterGrid>}
      </div>
    </section>
  );
}

function progressFor(rows: ReturnType<typeof useProgress>["data"], playlistId: string | null, itemId: string) {
  const row = (rows ?? []).find((entry) => entry.playlistId === playlistId && (entry.itemId === itemId || entry.seriesId === itemId) && !entry.completed);
  if (!row) return null;
  return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
}