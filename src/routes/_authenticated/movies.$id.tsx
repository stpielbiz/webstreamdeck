import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Play, Star } from "lucide-react";

import { getMovie, getPlayback } from "@/lib/iptv.functions";
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

export const Route = createFileRoute("/_authenticated/movies/$id")({
  validateSearch: z.object({ play: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Watch a film — Stream Deck" },
      {
        name: "description",
        content: "Film details, synopsis and playback with resume from where you stopped.",
      },
      { property: "og:title", content: "Watch a film — Stream Deck" },
      { property: "og:description", content: "Play a film from your own playlist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MovieDetail,
});

function MovieDetail() {
  const { id } = Route.useParams();
  const { activeId } = usePlaylists();
  const fetchMovie = useServerFn(getMovie);
  const fetchPlayback = useServerFn(getPlayback);
  const [playing, setPlaying] = useState(false);

  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const progress = useProgress();
  const saveProgress = useSaveProgress();

  const movie = useQuery({
    queryKey: ["movie", activeId, id],
    queryFn: () => fetchMovie({ data: { playlistId: activeId!, id } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const playback = useQuery({
    queryKey: ["playback", activeId, "movie", id, movie.data?.ext],
    queryFn: () =>
      fetchPlayback({
        data: { playlistId: activeId!, kind: "movie", itemId: id, ext: movie.data?.ext ?? null },
      }),
    enabled: !!activeId && playing,
    staleTime: 60_000,
  });

  const resumeAt =
    (progress.data ?? []).find(
      (row) => row.playlistId === activeId && row.itemId === id && !row.completed,
    )?.positionSeconds ?? 0;

  if (movie.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (movie.isError || !movie.data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{(movie.error as Error)?.message ?? "Not found."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/movies">Back to movies</Link>
        </Button>
      </div>
    );
  }

  const film = movie.data;
  const starred = isFavorite(favorites.data, activeId, "movie", id);

  return (
    <div className="space-y-6 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/movies">
          <ArrowLeft className="size-4" /> Movies
        </Link>
      </Button>

      {playing ? (
        <VideoPlayer
          src={playback.data?.url ?? null}
          title={film.name}
          poster={film.image}
          startPosition={resumeAt}
          onProgress={(position, duration) =>
            activeId &&
            void saveProgress({
              playlistId: activeId,
              itemKind: "movie",
              itemId: id,
              title: film.name,
              posterUrl: film.image,
              positionSeconds: position,
              durationSeconds: duration ?? film.durationSeconds,
            })
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            {film.image ? (
              <img src={film.image} alt={film.name} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[2/3] place-items-center p-4 text-center text-sm text-muted-foreground">
                {film.name}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold">{film.name}</h1>
            <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              {film.year && <span>{film.year}</span>}
              {film.genre && <span>{film.genre}</span>}
              {film.rating && <span>Rated {film.rating}</span>}
              {film.durationSeconds && <span>{Math.round(film.durationSeconds / 60)} min</span>}
            </p>
            {film.plot && <p className="mt-4 max-w-prose text-sm leading-relaxed">{film.plot}</p>}
            {film.cast && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Cast:</span> {film.cast}
              </p>
            )}
            {film.director && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Director:</span> {film.director}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setPlaying(true)}>
                <Play className="size-4" />
                {resumeAt > 30
                  ? `Resume at ${Math.floor(resumeAt / 60)}:${String(Math.floor(resumeAt % 60)).padStart(2, "0")}`
                  : "Play"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  activeId &&
                  toggle.mutate({
                    playlistId: activeId,
                    itemKind: "movie",
                    itemId: id,
                    title: film.name,
                    logoUrl: film.image,
                  })
                }
              >
                <Star className={cn("size-4", starred && "fill-primary text-primary")} />
                {starred ? "In favourites" : "Add to favourites"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
