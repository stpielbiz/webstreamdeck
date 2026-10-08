import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMovie, getPlayback, getSeries } from "@/lib/iptv.functions";
import type { EpisodeItem } from "@/lib/iptv-types";
import { isFavorite, useFavorites, useProgress, useSaveProgress, useToggleFavorite } from "@/lib/library-hooks";
import { getCachedTitleMetadata } from "@/lib/metadata.functions";
import type { TitleMetadata } from "@/lib/metadata.server";
import { findResume, useSyncPlaylists } from "@/lib/playlist-sync";
import { cn } from "@/lib/utils";

export type TitleKind = "movie" | "series";

/** Shared movie/show details window used by Movies, Shows and Home favourites. */
export function TitleDetailsDialog({
  kind,
  id,
  name,
  image,
  year,
  metadata: providedMetadata,
  onClose,
  onCloseAutoFocus,
}: {
  kind: TitleKind;
  id: string | null;
  name?: string | null;
  image?: string | null;
  year?: string | number | null;
  metadata?: TitleMetadata;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { activeId } = usePlaylists();
  const fetchMovie = useServerFn(getMovie);
  const fetchSeries = useServerFn(getSeries);
  const fetchPlayback = useServerFn(getPlayback);
  const fetchMetadata = useServerFn(getCachedTitleMetadata);
  const favorites = useFavorites();
  const progress = useProgress();
  const syncPlaylists = useSyncPlaylists();
  const toggleFavorite = useToggleFavorite();
  const saveProgress = useSaveProgress();
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [episode, setEpisode] = useState<EpisodeItem | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setSeasonIndex(0);
    setEpisode(null);
    setPlaying(false);
  }, [id, kind]);

  const ownMetadata = useQuery({
    queryKey: ["title-metadata-one", activeId, kind, name],
    queryFn: async () => (await fetchMetadata({ data: { playlistId: activeId ?? "", kind, names: [name ?? ""] } }))[name ?? ""],
    enabled: !providedMetadata && !!activeId && !!id && !!name,
    staleTime: 30 * 60_000,
  });
  const selectedMetadata = providedMetadata ?? ownMetadata.data ?? undefined;

  const movie = useQuery({
    queryKey: ["movie", activeId, id],
    queryFn: () => fetchMovie({ data: { playlistId: activeId ?? "", id: id ?? "" } }),
    enabled: !!activeId && kind === "movie" && !!id,
    staleTime: 10 * 60_000,
  });
  const series = useQuery({
    queryKey: ["series", activeId, id],
    queryFn: () => fetchSeries({ data: { playlistId: activeId ?? "", id: id ?? "" } }),
    enabled: !!activeId && kind === "series" && !!id,
    staleTime: 10 * 60_000,
  });
  const mediaId = kind === "movie" ? id : episode?.id ?? null;
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
  const title = kind === "movie" ? movie.data?.name ?? name : episode ? `${show?.name ?? ""} — S${episode.season} E${episode.episode}` : show?.name ?? name;
  const poster = kind === "movie" ? movie.data?.image ?? image : episode?.image ?? show?.image ?? image;
  const details = kind === "movie" ? movie.data : show;
  const overview = details?.plot || selectedMetadata?.overview;
  const detailGenres = selectedMetadata?.genres?.length ? selectedMetadata.genres : details?.genre ? [details.genre] : [];
  const detailYear = selectedMetadata?.year || year;
  const selectedProgress = (progress.data ?? []).find((row) => row.playlistId === activeId && (row.itemId === id || row.seriesId === id) && !row.completed);
  const selectedFavorite = id ? isFavorite(favorites.data, activeId, kind, id) : false;
  const resumeRow = mediaId ? findResume(progress.data, activeId, { itemId: mediaId, title, season: kind === "movie" ? null : episode?.season, episode: kind === "movie" ? null : episode?.episode }, syncPlaylists) : undefined;
  const resumeAt = resumeRow && !resumeRow.completed ? resumeRow.positionSeconds : 0;

  const close = () => {
    setEpisode(null);
    setPlaying(false);
    onClose();
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
      seriesId: kind === "series" ? id : null,
      season: episode?.season ?? null,
      episode: episode?.episode ?? null,
      title,
      posterUrl: poster ?? null,
      positionSeconds,
      durationSeconds: durationSeconds ?? null,
      external,
    });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} data-tv-zone="details" className="max-h-[86dvh] w-[min(92vw,56rem)] max-w-none gap-0 overflow-hidden p-0 sm:rounded-lg">
        <div className="scrollbar-thin max-h-[86dvh] overflow-y-auto">
          <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,46%)] md:p-5">
            <div className="min-w-0">
              <DialogHeader className="pr-8 text-left">
                <p className="text-xs font-semibold uppercase text-primary">{kind === "movie" ? "Movie" : "Show"}</p>
                <DialogTitle className="font-display text-2xl leading-tight">{selectedMetadata?.title || name || "Loading details"}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {detailYear && <span>{detailYear}</span>}
                  {detailGenres.map((item) => <span key={item}>{item}</span>)}
                  {selectedProgress && <span className="font-medium text-primary">Resume at {formatResume(selectedProgress.positionSeconds)}</span>}
                </DialogDescription>
              </DialogHeader>
              {overview && <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{overview}</p>}
              {(selectedMetadata?.cast?.length ?? 0) > 0 && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Cast:</span> {selectedMetadata!.cast.join(", ")}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {kind === "movie" && !playing && (
                  <Button data-tv-focus data-zone-entry="true" onClick={() => setPlaying(true)}><Play className="size-4" />{resumeAt > 0 ? "Resume" : "Play"}</Button>
                )}
                {id && <Button data-tv-focus variant="secondary" onClick={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: id, title: name ?? title ?? "", logoUrl: poster ?? null })}><Star className={cn("size-4", selectedFavorite && "fill-primary text-primary")} />{selectedFavorite ? "Remove from favourites" : "Add to favourites"}</Button>}
                <DialogClose asChild><Button data-dialog-back data-tv-focus variant="outline">Close</Button></DialogClose>
              </div>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {playing && mediaId ? (
                <VideoPlayer onStop={close} src={playback.data?.url ?? null} fallbackSrc={playback.data?.directUrl ?? null} title={title ?? ""} poster={poster ?? null} startPosition={resumeAt} onProgress={(position, duration) => record(position, duration)} onExternalLaunch={() => record(resumeAt, null, true)} {...(kind === "series" ? { onEnded: playNext } : {})} />
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
  );
}

function formatResume(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}
