import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, Star } from "lucide-react";
import { z } from "zod";

import { getPlayback, getSeries } from "@/lib/iptv.functions";
import type { EpisodeItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  isFavorite,
  useFavorites,
  useProgress,
  useSaveProgress,
  useToggleFavorite,
} from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/series/$id")({
  validateSearch: z.object({ play: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Watch a series — Stream Deck" },
      {
        name: "description",
        content: "Seasons, episode lists and playback that resumes each episode where you stopped.",
      },
      { property: "og:title", content: "Watch a series — Stream Deck" },
      { property: "og:description", content: "Play episodes from your own playlist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeriesDetail,
});

function SeriesDetail() {
  const { id } = Route.useParams();
  const { play } = Route.useSearch();
  const { activeId } = usePlaylists();
  const fetchSeries = useServerFn(getSeries);
  const fetchPlayback = useServerFn(getPlayback);

  const [seasonIndex, setSeasonIndex] = useState(0);
  const [current, setCurrent] = useState<EpisodeItem | null>(null);

  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const progress = useProgress();
  const saveProgress = useSaveProgress();

  const series = useQuery({
    queryKey: ["series", activeId, id],
    queryFn: () => fetchSeries({ data: { playlistId: activeId!, id } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const playback = useQuery({
    queryKey: ["playback", activeId, "episode", current?.id, current?.ext],
    queryFn: () =>
      fetchPlayback({
        data: {
          playlistId: activeId!,
          kind: "episode",
          itemId: current!.id,
          ext: current?.ext ?? null,
        },
      }),
    enabled: !!activeId && !!current,
    staleTime: 60_000,
  });

  const show = series.data;
  const seasons = show?.seasons ?? [];
  const season = seasons[seasonIndex];

  const lastWatched = useMemo(
    () =>
      (progress.data ?? []).find(
        (row) => row.playlistId === activeId && row.seriesId === id && !row.completed,
      ),
    [progress.data, activeId, id],
  );

  // Coming from a "continue watching" tile: start the right episode straight away.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (play !== true || autoStarted.current || current || seasons.length === 0) return;
    const all = seasons.flatMap((entry, index) =>
      entry.episodes.map((episode) => ({ episode, index })),
    );
    const target = lastWatched
      ? all.find((entry) => entry.episode.id === lastWatched.itemId)
      : undefined;
    const chosen = target ?? all[0];
    if (!chosen) return;
    autoStarted.current = true;
    setSeasonIndex(chosen.index);
    setCurrent(chosen.episode);
  }, [play, current, seasons, lastWatched]);

  const progressFor = (episodeId: string) => {
    const row = (progress.data ?? []).find(
      (entry) => entry.playlistId === activeId && entry.itemId === episodeId,
    );
    if (!row || !row.durationSeconds) return null;
    return row.positionSeconds / row.durationSeconds;
  };

  const playEpisode = (episode: EpisodeItem) => setCurrent(episode);

  const playNext = () => {
    if (!current || !season) return;
    const index = season.episodes.findIndex((episode) => episode.id === current.id);
    const next = season.episodes[index + 1] ?? seasons[seasonIndex + 1]?.episodes[0];
    if (next) {
      if (!season.episodes[index + 1]) setSeasonIndex((value) => value + 1);
      setCurrent(next);
    }
  };

  if (series.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (series.isError || !show) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {(series.error as Error)?.message ?? "Not found."}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/series">Back to series</Link>
        </Button>
      </div>
    );
  }

  const starred = isFavorite(favorites.data, activeId, "series", id);

  return (
    <div className="space-y-6 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/series">
          <ArrowLeft className="size-4" /> Series
        </Link>
      </Button>

      {current && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(30rem,1.4fr)]">
          <div className="min-w-0 lg:order-1">
            <h2 className="text-xl font-semibold">S{current.season} E{current.episode} — {current.title}</h2>
            {current.plot && <p className="mt-2 text-sm text-muted-foreground">{current.plot}</p>}
            <Button className="mt-3" variant="outline" size="sm" onClick={playNext}>Next episode</Button>
          </div>
          <div className="min-w-0 lg:order-2">
          <VideoPlayer
            src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
            title={`${show.name} — S${current.season} E${current.episode} ${current.title}`}
            poster={current.image ?? show.image}
            startPosition={
              (progress.data ?? []).find(
                (row) => row.playlistId === activeId && row.itemId === current.id,
              )?.positionSeconds ?? 0
            }
            onExternalLaunch={() =>
              activeId &&
              void saveProgress({
                playlistId: activeId,
                itemKind: "episode",
                itemId: current.id,
                seriesId: id,
                season: current.season,
                episode: current.episode,
                title: `${show.name} — S${current.season} E${current.episode}`,
                posterUrl: show.image,
                positionSeconds: 0,
                external: true,
              })
            }
            onProgress={(position, duration) =>
              activeId &&
              void saveProgress({
                playlistId: activeId,
                itemKind: "episode",
                itemId: current.id,
                seriesId: id,
                season: current.season,
                episode: current.episode,
                title: `${show.name} — S${current.season} E${current.episode}`,
                posterUrl: show.image,
                positionSeconds: position,
                durationSeconds: duration ?? current.durationSeconds,
              })
            }
            onEnded={playNext}
          />
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          {show.image ? (
            <img src={show.image} alt={show.name} className="aspect-[2/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[2/3] place-items-center p-4 text-center text-sm text-muted-foreground">
              {show.name}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">{show.name}</h1>
          <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {show.year && <span>{show.year}</span>}
            {show.genre && <span>{show.genre}</span>}
            <span>
              {seasons.length} season{seasons.length === 1 ? "" : "s"}
            </span>
          </p>
          {show.plot && <p className="mt-4 max-w-prose text-sm leading-relaxed">{show.plot}</p>}
          {show.cast && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Cast:</span> {show.cast}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {lastWatched && (
              <Button
                onClick={() => {
                  const target = seasons
                    .flatMap((entry, index) =>
                      entry.episodes.map((episode) => ({ episode, index })),
                    )
                    .find((entry) => entry.episode.id === lastWatched.itemId);
                  if (target) {
                    setSeasonIndex(target.index);
                    setCurrent(target.episode);
                  }
                }}
              >
                <Play className="size-4" /> Resume S{lastWatched.season} E{lastWatched.episode}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                activeId &&
                toggle.mutate({
                  playlistId: activeId,
                  itemKind: "series",
                  itemId: id,
                  title: show.name,
                  logoUrl: show.image,
                })
              }
            >
              <Star className={cn("size-4", starred && "fill-primary text-primary")} />
              {starred ? "In favourites" : "Add to favourites"}
            </Button>
          </div>

          {seasons.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex flex-wrap gap-2">
                {seasons.map((entry, index) => (
                  <button
                    key={entry.season}
                    type="button"
                    onClick={() => setSeasonIndex(index)}
                    className={cn(
                      "rounded-md border border-border px-3 py-1.5 text-sm transition hover:border-primary/60",
                      index === seasonIndex && "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    Season {entry.season}
                  </button>
                ))}
              </div>

              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {(season?.episodes ?? []).map((episode) => {
                  const watched = progressFor(episode.id);
                  return (
                    <li key={episode.id}>
                      <button
                        type="button"
                        onClick={() => playEpisode(episode)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted",
                          current?.id === episode.id && "bg-muted",
                        )}
                      >
                        <span className="w-10 shrink-0 text-center font-display text-sm text-muted-foreground">
                          {episode.episode}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {episode.title}
                          </span>
                          {episode.plot && (
                            <span className="line-clamp-2 block text-xs text-muted-foreground">
                              {episode.plot}
                            </span>
                          )}
                          {watched != null && watched > 0 && (
                            <span className="mt-1.5 block h-1 w-32 rounded bg-muted-foreground/30">
                              <span
                                className="block h-full rounded bg-primary"
                                style={{ width: `${Math.min(100, watched * 100)}%` }}
                              />
                            </span>
                          )}
                        </span>
                        <Play className="size-4 shrink-0 text-primary" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
