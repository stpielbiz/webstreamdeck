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
import type { CatalogItem } from "@/lib/iptv-types";
import { cleanVariantTitle, mediaMatchKey, type TitleVariant } from "@/lib/title-variants";
import { FranchiseDetails } from "@/components/franchise-details";

export type TitleKind = "movie" | "series";

/** Shared movie/show details window used by Movies, Shows and Home favourites. */
export function TitleDetailsDialog(props: Omit<Parameters<typeof TitleDetailsContent>[0], "onSelectRelated" | "parentTitle">) {
  const [history, setHistory] = useState<Array<{ kind: TitleKind; group: import("@/lib/title-variants").TitleGroup }>>([]);
  useEffect(() => { setHistory([]); }, [props.id, props.kind]);
  const selected = history.at(-1);
  const previous = history.at(-2);
  return <TitleDetailsContent
    {...props}
    {...(selected ? { kind: selected.kind, id: selected.group.item.id, name: selected.group.title, image: selected.group.item.image, year: selected.group.year, variants: selected.group.variants, metadata: undefined } : {})}
    key={`${props.id}-${history.length}-${selected?.group.item.id ?? "original"}`}
    parentTitle={selected ? previous?.group.title ?? props.name ?? "title" : undefined}
    onClose={() => selected ? setHistory((items) => items.slice(0, -1)) : props.onClose()}
    onSelectRelated={(kind, group) => setHistory((items) => [...items, { kind, group }])}
  />;
}

function TitleDetailsContent({
  kind,
  id,
  name,
  image,
  year,
  metadata: providedMetadata,
  variants,
  onClose,
  onCloseAutoFocus,
  onSelectRelated,
  parentTitle,
}: {
  kind: TitleKind;
  id: string | null;
  name?: string | null | undefined;
  image?: string | null | undefined;
  year?: string | number | null | undefined;
  metadata?: TitleMetadata | undefined;
  variants?: TitleVariant[] | undefined;
  onClose: () => void;
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
  onSelectRelated: (kind: TitleKind, group: import("@/lib/title-variants").TitleGroup) => void;
  parentTitle?: string | undefined;
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
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(id);

  useEffect(() => {
    setSeasonIndex(0);
    setEpisode(null);
    setPlaying(false);
    setSelectedVariantId(id);
  }, [id, kind]);

  const availableVariants = variants?.length ? variants : id ? [{ item: { id, name: name ?? "", image: image ?? null, categoryId: null } satisfies CatalogItem, label: "Link 1", tags: [], qualityRank: 1 }] : [];
  const selectedVariant = availableVariants.find((variant) => variant.item.id === selectedVariantId) ?? availableVariants[0];
  const activeItem = selectedVariant?.item;
  const activeItemId = activeItem?.id ?? id;

  const ownMetadata = useQuery({
    queryKey: ["title-metadata-one", activeId, kind, name],
    queryFn: async () => (await fetchMetadata({ data: { playlistId: activeId ?? "", kind, names: [name ?? ""] } }))[name ?? ""],
    enabled: !providedMetadata && !!activeId && !!id && !!name,
    staleTime: 30 * 60_000,
  });
  const selectedMetadata = providedMetadata ?? ownMetadata.data ?? undefined;

  const movie = useQuery({
    queryKey: ["movie", activeId, activeItemId],
    queryFn: () => fetchMovie({ data: { playlistId: activeId ?? "", id: activeItemId ?? "" } }),
    enabled: !!activeId && kind === "movie" && !!activeItemId,
    staleTime: 10 * 60_000,
  });
  const series = useQuery({
    queryKey: ["series", activeId, activeItemId],
    queryFn: () => fetchSeries({ data: { playlistId: activeId ?? "", id: activeItemId ?? "" } }),
    enabled: !!activeId && kind === "series" && !!activeItemId,
    staleTime: 10 * 60_000,
  });
  const mediaId = kind === "movie" ? activeItemId : episode?.id ?? null;
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
  const variantIds = new Set(availableVariants.map((variant) => variant.item.id));
  const selectedProgress = (progress.data ?? []).find((row) => row.playlistId === activeId && (variantIds.has(row.itemId) || (row.seriesId ? variantIds.has(row.seriesId) : false) || mediaMatchKey(row.title) === mediaMatchKey(name ?? "")) && !row.completed);
  const selectedFavorite = availableVariants.some((variant) => isFavorite(favorites.data, activeId, kind, variant.item.id));
  const variantResume = mediaId ? (progress.data ?? []).find((row) => row.playlistId === activeId && !row.completed && (row.itemId === mediaId || (kind === "movie" && variantIds.has(row.itemId)) || (kind === "series" && row.seriesId != null && variantIds.has(row.seriesId) && row.season === episode?.season && row.episode === episode?.episode))) : undefined;
  const resumeRow = variantResume ?? (mediaId ? findResume(progress.data, activeId, { itemId: mediaId, title, season: kind === "movie" ? null : episode?.season, episode: kind === "movie" ? null : episode?.episode }, syncPlaylists) : undefined);
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
      seriesId: kind === "series" ? activeItemId : null,
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
      <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [data-details-entry]')?.focus({ preventScroll: true })); }} onCloseAutoFocus={onCloseAutoFocus} data-tv-zone="details" className="max-h-[86dvh] w-[min(92vw,56rem)] max-w-none gap-0 overflow-hidden p-0 sm:rounded-lg">
        <div className="scrollbar-thin max-h-[86dvh] overflow-y-auto">
          <div className="sticky top-0 z-20 space-y-2 border-b border-border bg-background p-4 pr-12">
              <div data-remote-row className="flex flex-wrap gap-2">
                {(
                  <Button data-tv-focus data-zone-entry="true" data-details-entry onClick={() => { if (kind === "series" && !episode) { const first = seasons[0]?.episodes[0]; if (!first) return; setSeasonIndex(0); setEpisode(first); } setPlaying(true); }}><Play className="size-4" />{resumeAt > 0 ? "Resume" : "Play"}</Button>
                )}
                {activeItemId && <Button data-tv-focus variant="secondary" onClick={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: kind, itemId: selectedFavorite ? availableVariants.find((variant) => isFavorite(favorites.data, activeId, kind, variant.item.id))?.item.id ?? activeItemId : activeItemId, title: selectedMetadata?.title ?? name ?? title ?? "", logoUrl: poster ?? null })}><Star className={cn("size-4", selectedFavorite && "fill-primary text-primary")} />{selectedFavorite ? "Remove from favourites" : "Add to favourites"}</Button>}
                <DialogClose asChild><Button data-dialog-back data-tv-focus variant="outline" className="h-auto whitespace-normal py-2">{parentTitle ? `Back to ${parentTitle}` : "Close"}</Button></DialogClose>
              </div>
              {availableVariants.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Version</p>
                  <div data-remote-row className="flex flex-wrap gap-2">
                    {availableVariants.map((variant) => <Button key={variant.item.id} data-tv-focus size="sm" variant={activeItemId === variant.item.id ? "default" : "outline"} onClick={() => { setSelectedVariantId(variant.item.id); setSeasonIndex(0); setEpisode(null); setPlaying(false); }}>{variant.label}</Button>)}
                  </div>
                </div>
              )}

          </div>
          <div className="px-4 pb-4 md:px-5">
            {id && name && <FranchiseDetails title={cleanVariantTitle(name).replace(/[[(]\s*(?:US|UK|CA|AU|EN|FR|DE|ES|IT)\s*[\])]/gi, "").trim()} kind={kind} onSelect={onSelectRelated} />}
          </div>
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
              {(selectedMetadata?.cast?.length ?? 0) > 0 && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Cast:</span> {selectedMetadata?.cast.join(", ")}</p>}

            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {playing && mediaId ? (
                <VideoPlayer onStop={close} src={playback.data?.url ?? null} fallbackSrc={playback.data?.directUrl ?? null} title={title ?? ""} poster={poster ?? null} startPosition={resumeAt} onProgress={(position, duration) => record(position, duration)} onExternalLaunch={() => record(resumeAt, null, true)} {...(kind === "series" ? { onEnded: playNext } : {})} />
              ) : (
                 <div className="relative grid h-full w-full place-items-center bg-card/80">
                   {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain" />}
                 </div>
              )}
            </div>
          </div>
          {kind === "series" && show && (
            <section className="border-t border-border p-4 md:p-5">
              <div data-remote-row className="mb-3 flex gap-2 overflow-x-auto p-1">{seasons.map((entry, index) => <Button key={entry.season} data-tv-focus size="sm" variant={index === seasonIndex ? "default" : "secondary"} onClick={() => { setSeasonIndex(index); setEpisode(null); setPlaying(false); }}>Season {entry.season}</Button>)}</div>
              <div className="grid gap-2">{(season?.episodes ?? []).map((item) => <div data-remote-row key={item.id}><Button data-tv-focus variant={episode?.id === item.id && playing ? "default" : "outline"} className="h-auto min-h-12 w-full justify-start whitespace-normal px-3 py-2 text-left" onClick={() => { setEpisode(item); setPlaying(true); }}><Play className="size-4 shrink-0" /><span className="truncate">E{item.episode} · {item.title}</span></Button></div>)}</div>
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
