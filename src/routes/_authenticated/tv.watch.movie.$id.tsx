import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMovie, getPlayback } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { VideoPlayer } from "@/components/video-player";
import { useProgress, useSaveProgress } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/tv/watch/movie/$id")({
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
  const { activeId } = usePlaylists();
  const fetchMovie = useServerFn(getMovie);
  const fetchPlayback = useServerFn(getPlayback);
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
    enabled: !!activeId && !!movie.data,
    staleTime: 60_000,
  });

  const film = movie.data;
  const resumeAt =
    (progress.data ?? []).find(
      (row) => row.playlistId === activeId && row.itemId === id && !row.completed,
    )?.positionSeconds ?? 0;

  return (
    <TvShell title={film?.name ?? "Loading…"}>
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
      {film?.plot && <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{film.plot}</p>}
    </TvShell>
  );
}
