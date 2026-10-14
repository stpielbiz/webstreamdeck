import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/video-player";
import { useGetPlayback, useGetSeries } from "@/lib/device-provider";
import type { Franchise } from "@/lib/franchise.functions";
import type { ProgressRow } from "@/lib/iptv.functions";
import type { CatalogItem, EpisodeItem } from "@/lib/iptv-types";
import { useProgress, useSaveProgress } from "@/lib/library-hooks";
import { findResume, useSyncPlaylists } from "@/lib/playlist-sync";
import type { TitleGroup } from "@/lib/title-variants";
import { cn } from "@/lib/utils";
import { completedForVariants, progressForVariants } from "@/lib/watch-progress";
import { useFranchiseMatches } from "@/components/franchise-details";

type Playing = {
  kind: "movie" | "episode";
  id: string;
  ext: string | null;
  title: string;
  image: string | null;
  seriesId?: string;
  season?: number;
  episode?: number;
  durationSeconds?: number | null;
  focusKey: string;
};

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span className="absolute inset-x-0 bottom-0 h-1 bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }} /></span>;
}

const rowClass = "relative flex w-full items-center gap-3 overflow-hidden rounded px-2 py-2 text-left outline-none hover:bg-secondary focus:bg-secondary focus:ring-2 focus:ring-primary";

export function FranchiseCollectionPage({ franchise, movies, shows, onBack }: {
  franchise: Franchise;
  movies?: CatalogItem[];
  shows?: CatalogItem[];
  onBack: () => void;
}) {
  const { activeId } = usePlaylists();
  const progress = useProgress();
  const syncPlaylists = useSyncPlaylists();
  const saveProgress = useSaveProgress();
  const fetchPlayback = useGetPlayback();
  const matches = useFranchiseMatches(franchise, movies, shows);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const movieMatches = useMemo(() => matches.filter((m) => m.member.kind === "movie").sort((a, b) => (a.member.year ?? 9999) - (b.member.year ?? 9999)), [matches]);
  const showMatches = useMemo(() => matches.filter((m) => m.member.kind === "series").sort((a, b) => (a.member.year ?? 9999) - (b.member.year ?? 9999)), [matches]);

  const playback = useQuery({
    queryKey: ["playback", activeId, playing?.kind, playing?.id, playing?.ext],
    queryFn: () => fetchPlayback({ data: { playlistId: activeId ?? "", kind: playing!.kind, itemId: playing!.id, ext: playing!.ext } }),
    enabled: !!activeId && !!playing,
    staleTime: 60_000,
  });
  const resumeRow = playing ? findResume(progress.data, activeId, { itemId: playing.id, title: playing.title, season: playing.season, episode: playing.episode }, syncPlaylists) : undefined;
  const resumeAt = resumeRow && !resumeRow.completed ? resumeRow.positionSeconds : 0;

  const stop = () => {
    const key = playing?.focusKey;
    setPlaying(null);
    window.requestAnimationFrame(() => { if (key) document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)?.focus(); });
  };
  const save = (position: number, duration: number | null) => {
    if (!activeId || !playing) return;
    void saveProgress({
      playlistId: activeId,
      itemKind: playing.kind,
      itemId: playing.id,
      seriesId: playing.seriesId ?? null,
      season: playing.season ?? null,
      episode: playing.episode ?? null,
      title: playing.title,
      posterUrl: playing.image,
      positionSeconds: position,
      durationSeconds: duration ?? playing.durationSeconds ?? null,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Button data-layer-back data-tv-focus variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Franchises</Button>
        <h1 className="font-display text-2xl font-bold">{franchise.name}</h1>
      </div>

      {movieMatches.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold text-primary">Movies</h2>
          <ul className="space-y-1">
            {movieMatches.map(({ member, group }, index) => {
              const value = group ? progressForVariants(progress.data, activeId, group.variants, group.title) : null;
              const done = group ? completedForVariants(progress.data, activeId, group.variants, group.title) : false;
              const key = `fr-movie-${group?.item.id ?? member.title}`;
              return (
                <li key={`${member.title}-${member.year}`} data-remote-row>
                  <button type="button" data-tv-focus data-zone-entry={index === 0 ? "true" : undefined} data-focus-key={key} disabled={!group}
                    onClick={() => group && setPlaying({ kind: "movie", id: group.item.id, ext: group.item.ext ?? null, title: group.title, image: group.item.image, focusKey: key })}
                    className={cn(rowClass, !group && "opacity-50")}>
                    <Thumb src={group?.item.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{member.title}</span>
                      <span className="block text-xs text-muted-foreground">{member.year ?? "—"}{!group && " · Not in your list"}{done && " · Watched"}{value !== null && " · Resume"}</span>
                    </span>
                    {done ? <Check className="size-4 text-primary" /> : group && <Play className="size-4 text-muted-foreground" />}
                    <ProgressBar value={value} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showMatches.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold text-primary">Shows</h2>
          <div className="space-y-5">
            {showMatches.map(({ member, group }) => group
              ? <ShowBlock key={group.item.id} group={group} rows={progress.data} onPlay={setPlaying} first={movieMatches.length === 0} />
              : <p key={member.title} className="px-2 text-sm text-muted-foreground opacity-60">{member.title} · {member.year ?? "—"} · Not in your list</p>)}
          </div>
        </div>
      )}

      <Dialog open={!!playing} onOpenChange={(open) => { if (!open) stop(); }}>
        <DialogContent className="max-w-5xl p-3">
          <DialogTitle className="truncate pr-8">{playing?.title}</DialogTitle>
          <DialogDescription className="sr-only">Now playing</DialogDescription>
          <VideoPlayer
            src={playing ? playback.data?.url ?? null : null}
            fallbackSrc={playing ? playback.data?.directUrl ?? null : null}
            title={playing?.title ?? ""}
            poster={playing?.image ?? null}
            startPosition={resumeAt}
            className="aspect-video w-full overflow-hidden rounded"
            onStop={stop}
            onRefreshSource={() => playback.refetch()}
            onProgress={save}
            onExternalLaunch={() => save(0, null)}
          />
          <Button data-dialog-back data-tv-focus variant="secondary" size="sm" onClick={stop}>Close</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">{src && <img src={src} alt="" loading="lazy" className="size-full object-cover" />}</span>;
}

function ShowBlock({ group, rows, onPlay, first }: { group: TitleGroup; rows?: ProgressRow[]; onPlay: (p: Playing) => void; first: boolean }) {
  const { activeId } = usePlaylists();
  const fetchSeries = useGetSeries();
  const seriesId = group.item.id;
  const series = useQuery({
    queryKey: ["series", activeId, seriesId],
    queryFn: () => fetchSeries({ data: { playlistId: activeId ?? "", id: seriesId } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });
  const seasons = series.data?.seasons ?? [];
  const episodeRow = (id: string) => (rows ?? []).find((row) => row.playlistId === activeId && row.itemId === id);
  const all = seasons.flatMap((s) => s.episodes);
  const lastRow = (rows ?? []).find((row) => row.playlistId === activeId && row.seriesId === seriesId);
  const resumeEpisode = (() => {
    if (!all.length) return null;
    if (lastRow) {
      const index = all.findIndex((e) => e.id === lastRow.itemId);
      if (index >= 0) return lastRow.completed ? all[index + 1] ?? all[index] : all[index];
    }
    return all.find((e) => !episodeRow(e.id)?.completed) ?? all[0];
  })();
  const play = (episode: EpisodeItem, focusKey: string) => onPlay({
    kind: "episode", id: episode.id, ext: episode.ext, title: `${group.title} — S${episode.season} E${episode.episode}`,
    image: episode.image ?? group.item.image, seriesId, season: episode.season, episode: episode.episode, durationSeconds: episode.durationSeconds, focusKey,
  });
  const showKey = `fr-show-${seriesId}`;

  return (
    <div className="rounded border border-border bg-card/50 p-2">
      <div data-remote-row>
        <button type="button" data-tv-focus data-zone-entry={first ? "true" : undefined} data-focus-key={showKey} disabled={!resumeEpisode}
          onClick={() => resumeEpisode && play(resumeEpisode, showKey)} className={rowClass}>
          <Thumb src={group.item.image} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{group.title}</span>
            <span className="block text-xs text-muted-foreground">
              {series.isLoading ? "Loading seasons…" : resumeEpisode ? `${lastRow ? "Continue" : "Start"} S${resumeEpisode.season} E${resumeEpisode.episode}` : "No episodes found"}
            </span>
          </span>
          <Play className="size-4 text-primary" />
        </button>
      </div>
      {seasons.map((season) => {
        const watched = season.episodes.filter((e) => episodeRow(e.id)?.completed).length;
        return (
          <div key={season.season} className="mt-3 pl-2">
            <h3 className="mb-1 text-sm font-semibold">Season {season.season} <span className="text-xs font-normal text-muted-foreground">· {watched} of {season.episodes.length} watched</span></h3>
            <ul className="space-y-0.5">
              {season.episodes.map((episode) => {
                const row = episodeRow(episode.id);
                const key = `fr-ep-${episode.id}`;
                const value = row && !row.completed ? (row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05) : null;
                return (
                  <li key={episode.id} data-remote-row>
                    <button type="button" data-tv-focus data-focus-key={key} onClick={() => play(episode, key)} className={cn(rowClass, "py-1.5")}>
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">E{episode.episode}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{episode.title}</span>
                      {row?.completed ? <span className="flex items-center gap-1 text-xs text-primary"><Check className="size-3" /> Watched</span> : value !== null && <span className="text-xs text-muted-foreground">Resume</span>}
                      <ProgressBar value={value} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
