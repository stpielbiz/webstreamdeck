import { findResume, useSyncPlaylists } from "@/lib/playlist-sync";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMovie, getPlayback } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { VideoPlayer } from "@/components/video-player";
import { useProgress, useSaveProgress } from "@/lib/library-hooks";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/tv/watch/movie/$id")({
  validateSearch: z.object({ from: z.enum(["home", "favorites", "movies"]).optional() }),
  head: () => ({
    meta: [
      { title: "Watch a film on your TV — Stream Deck" },
      {
        name: "description",
        content: "Full-screen film playback with remote controls and resume from where you stopped.",
      },
      { property: "og:title", content: "Watch a film on your TV — Stream Deck" },
      { property: "og:description", content: "Big-screen film playback." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TvWatchMovie,
});

function TvWatchMovie() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchMovie = useServerFn(getMovie);
  const fetchPlayback = useServerFn(getPlayback);
  const progress = useProgress();
  const syncPlaylists = useSyncPlaylists();
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
    enabled: !!activeId && !!movie.data,
    staleTime: 60_000,
  });

  const film = movie.data;
  const resumeAt =
    ((r) => (r && !r.completed ? r.positionSeconds : 0))(findResume(progress.data, activeId, { itemId: id, title: movie.data?.name }, syncPlaylists));

  return (
    <TvShell title={film?.name ?? "Loading…"} onBack={() => void navigate({ to: from === "favorites" ? "/tv/favorites" : from === "home" ? "/tv" : "/tv/movies" })}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(28rem,1.35fr)]">
      <div className="min-w-0 lg:order-1">
        <h2 className="text-2xl font-semibold">{film?.name}</h2>
        {film?.plot && <p className="mt-3 text-lg text-muted-foreground">{film.plot}</p>}
      </div>
      <div className="min-w-0 lg:order-2">
      <VideoPlayer
        src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
        title={film?.name ?? ""}
        poster={film?.image ?? null}
        startPosition={resumeAt}
        className="aspect-video w-full overflow-hidden rounded-xl"
        onExternalLaunch={() =>
          activeId &&
          film &&
          void saveProgress({
            playlistId: activeId,
            itemKind: "movie",
            itemId: id,
            title: film.name,
            posterUrl: film.image,
            positionSeconds: 0,
            external: true,
          })
        }
        onProgress={(position, duration) =>
          activeId &&
          film &&
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
      {playback.isError && (
        <p className="mt-4 text-xl text-destructive">
          This film could not be started. Try another title or check your provider.
        </p>
      )}
      </div>
      </div>
    </TvShell>
  );
}
