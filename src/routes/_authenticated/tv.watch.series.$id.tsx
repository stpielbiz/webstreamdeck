import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getPlayback, getSeries } from "@/lib/iptv.functions";
import type { EpisodeItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { VideoPlayer } from "@/components/video-player";
import { useProgress, useSaveProgress } from "@/lib/library-hooks";
import { cn } from "@/lib/utils";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/tv/watch/series/$id")({
  validateSearch: z.object({ from: z.enum(["home", "favorites", "series"]).optional() }),
  head: () => ({
    meta: [
      { title: "Watch a series on your TV — Stream Deck" },
      {
        name: "description",
        content: "Pick a season and episode with the remote and carry on where you stopped.",
      },
      { property: "og:title", content: "Watch a series on your TV — Stream Deck" },
      { property: "og:description", content: "Big-screen episode playback." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TvWatchSeries,
});

function TvWatchSeries() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchSeries = useServerFn(getSeries);
  const fetchPlayback = useServerFn(getPlayback);
  const progress = useProgress();
  const saveProgress = useSaveProgress();

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

  const resumeAt =
    (progress.data ?? []).find(
      (row) => row.playlistId === activeId && row.itemId === current?.id && !row.completed,
    )?.positionSeconds ?? 0;

  const playNext = () => {
    if (!current || !season) return;
    const index = season.episodes.findIndex((episode) => episode.id === current.id);
    const next = season.episodes[index + 1] ?? seasons[seasonIndex + 1]?.episodes[0];
    if (!next) return;
    if (!season.episodes[index + 1]) setSeasonIndex((value) => value + 1);
    setCurrent(next);
  };

  return (
    <TvShell title={show?.name ?? "Loading…"} onBack={() => void navigate({ to: from === "favorites" ? "/tv/favorites" : from === "home" ? "/tv" : "/tv/series" })}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(20rem,1fr)_minmax(28rem,1.35fr)]">
        <div className="lg:order-2">
          <VideoPlayer
            src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
            title={current?.title ?? ""}
            poster={current?.image ?? show?.image ?? null}
            startPosition={resumeAt}
            className="aspect-video w-full overflow-hidden rounded-xl"
            onEnded={playNext}
            onExternalLaunch={() =>
              activeId &&
              current &&
              void saveProgress({
                playlistId: activeId,
                itemKind: "episode",
                itemId: current.id,
                seriesId: id,
                season: current.season,
                episode: current.episode,
                title: current.title,
                posterUrl: current.image ?? show?.image ?? null,
                positionSeconds: 0,
                external: true,
              })
            }
            onProgress={(position, duration) =>
              activeId &&
              current &&
              void saveProgress({
                playlistId: activeId,
                itemKind: "episode",
                itemId: current.id,
                seriesId: id,
                season: current.season,
                episode: current.episode,
                title: current.title,
                posterUrl: current.image ?? show?.image ?? null,
                positionSeconds: position,
                durationSeconds: duration ?? current.durationSeconds,
              })
            }
          />
          <p className="mt-3 text-2xl font-semibold">
            {current ? `S${current.season} E${current.episode} — ${current.title}` : "Pick an episode"}
          </p>
        </div>

        <div className="space-y-4 lg:order-1">
          {series.isLoading && <p className="text-xl text-muted-foreground">Loading episodes…</p>}
          <div className="flex flex-wrap gap-2">
            {seasons.map((entry, index) => (
              <button
                key={entry.season}
                type="button"
                data-tv-focus
                onClick={() => setSeasonIndex(index)}
                className={cn(
                  "rounded-lg px-4 py-2 text-base font-medium outline-none focus:ring-4 focus:ring-primary/40",
                  index === seasonIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                Season {entry.season}
              </button>
            ))}
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {(season?.episodes ?? []).map((episode) => (
              <button
                key={episode.id}
                type="button"
                data-tv-focus
                onClick={() => setCurrent(episode)}
                className={cn(
                  "w-full rounded-lg border border-border px-4 py-3 text-left text-lg outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/40",
                  current?.id === episode.id ? "bg-secondary" : "bg-card",
                )}
              >
                <span className="mr-2 text-muted-foreground">E{episode.episode}</span>
                <span className="truncate">{episode.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </TvShell>
  );
}
