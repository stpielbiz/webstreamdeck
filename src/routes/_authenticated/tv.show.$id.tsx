import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Star } from "lucide-react";
import { useState } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { getPlayback, getSeries } from "@/lib/iptv.functions";
import type { EpisodeItem } from "@/lib/iptv-types";
import { isFavorite, useFavorites, useProgress, useSaveProgress, useToggleFavorite } from "@/lib/library-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tv/show/$id")({
  head: () => ({
    meta: [
      { title: "Show details — Stream Deck" },
      { name: "description", content: "Full show details with every season and episode, ready to play from your remote." },
      { property: "og:title", content: "Show details — Stream Deck" },
      { property: "og:description", content: "Seasons, episodes and show info on your TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TvShowDetails,
});

function formatLength(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function TvShowDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchSeries = useServerFn(getSeries);
  const fetchPlayback = useServerFn(getPlayback);
  const progress = useProgress();
  const saveProgress = useSaveProgress();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [current, setCurrent] = useState<EpisodeItem | null>(null);

  const series = useQuery({
    queryKey: ["series", activeId, id],
    queryFn: () => fetchSeries({ data: { playlistId: activeId!, id } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });
  const playback = useQuery({
    queryKey: ["playback", activeId, "episode", current?.id, current?.ext],
    queryFn: () => fetchPlayback({ data: { playlistId: activeId!, kind: "episode", itemId: current!.id, ext: current?.ext ?? null } }),
    enabled: !!activeId && !!current,
    staleTime: 60_000,
  });

  const show = series.data;
  const seasons = show?.seasons ?? [];
  const season = seasons[seasonIndex];
  const rowFor = (episodeId: string) => (progress.data ?? []).find((row) => row.playlistId === activeId && row.itemId === episodeId);
  const resumeAt = current ? (rowFor(current.id)?.completed ? 0 : rowFor(current.id)?.positionSeconds ?? 0) : 0;
  const fav = isFavorite(favorites.data, activeId, "series", id);

  const stopEpisode = () => {
    const episodeId = current?.id;
    setCurrent(null);
    window.requestAnimationFrame(() => {
      if (episodeId) document.querySelector<HTMLElement>(`[data-focus-key="show-episode-${CSS.escape(episodeId)}"]`)?.focus();
    });
  };
  const playNext = () => {
    if (!current || !season) return;
    const index = season.episodes.findIndex((episode) => episode.id === current.id);
    const next = season.episodes[index + 1] ?? seasons[seasonIndex + 1]?.episodes[0];
    if (!next) return stopEpisode();
    if (!season.episodes[index + 1]) setSeasonIndex((value) => value + 1);
    setCurrent(next);
  };
  const save = (position: number, duration: number | null, external = false) => {
    if (!activeId || !current) return;
    void saveProgress({
      playlistId: activeId, itemKind: "episode", itemId: current.id, seriesId: id,
      season: current.season, episode: current.episode, title: current.title,
      posterUrl: current.image ?? show?.image ?? null, positionSeconds: position,
      durationSeconds: duration ?? current.durationSeconds, external,
    });
  };

  return (
    <TvShell title={show?.name ?? "Loading…"} onBack={() => { if (current) stopEpisode(); else void navigate({ to: "/tv" }); }}>
      {series.isLoading && <p className="text-muted-foreground">Loading show…</p>}
      {series.isError && <p className="text-destructive">This show could not be loaded. Try again shortly.</p>}
      {show && (
        <div className="grid min-h-0 gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="aspect-[2/3] overflow-hidden rounded border border-border bg-muted">
              {show.image && <img src={show.image} alt={show.name} className="size-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
            </div>
            <Button
              data-tv-focus
              variant="secondary"
              className="w-full focus:ring-2 focus:ring-primary"
              onClick={() => activeId && toggleFavorite.mutate({ playlistId: activeId, itemKind: "series", itemId: id, title: show.name, logoUrl: show.image })}
            >
              <Star className={cn("size-4", fav && "fill-primary text-primary")} /> {fav ? "Favourite" : "Add to favourites"}
            </Button>
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold">{show.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{[show.year, show.genre, show.rating && `Rating ${show.rating}`, seasons.length && `${seasons.length} season${seasons.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
              {show.plot && <p className="mt-3 max-w-3xl text-sm leading-relaxed">{show.plot}</p>}
              {show.cast && <p className="mt-2 max-w-3xl text-xs text-muted-foreground">Cast: {show.cast}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {seasons.map((entry, index) => (
                <Button
                  key={entry.season}
                  data-tv-focus
                  data-zone-entry={index === seasonIndex ? "true" : undefined}
                  size="sm"
                  variant={index === seasonIndex ? "default" : "secondary"}
                  className="focus:ring-2 focus:ring-primary"
                  onClick={() => setSeasonIndex(index)}
                >
                  Season {entry.season}
                </Button>
              ))}
            </div>
            <ul className="space-y-1.5">
              {(season?.episodes ?? []).map((episode) => {
                const row = rowFor(episode.id);
                const pct = row && !row.completed && row.durationSeconds ? Math.min(100, (row.positionSeconds / row.durationSeconds) * 100) : row?.completed ? 100 : 0;
                return (
                  <li key={episode.id}>
                    <button
                      type="button"
                      data-tv-focus
                      data-focus-key={`show-episode-${episode.id}`}
                      onClick={() => setCurrent(episode)}
                      className="flex w-full items-start gap-3 rounded border border-border bg-card px-3 py-2 text-left outline-none focus:border-primary focus:bg-secondary focus:ring-2 focus:ring-primary"
                    >
                      <Play className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground">E{episode.episode}</span>
                          <span className="truncate text-sm font-semibold">{episode.title}</span>
                          {formatLength(episode.durationSeconds) && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatLength(episode.durationSeconds)}</span>}
                        </span>
                        {episode.plot && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{episode.plot}</span>}
                        {pct > 0 && <span className="mt-1.5 block h-1 overflow-hidden rounded bg-muted"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      {current && (
        <div data-tv-zone="show-player" className="fixed inset-0 z-50 bg-background">
          <VideoPlayer
            onStop={stopEpisode}
            src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
            title={`S${current.season} E${current.episode} — ${current.title}`}
            poster={current.image ?? show?.image ?? null}
            startPosition={resumeAt}
            className="size-full"
            onEnded={playNext}
            onExternalLaunch={() => save(0, null, true)}
            onProgress={(position, duration) => save(position, duration ?? null)}
          />
        </div>
      )}
    </TvShell>
  );
}
