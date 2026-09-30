import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Tv } from "lucide-react";

import { usePlaylists } from "@/components/playlist-context";
import { EmptyState, PosterGrid, PosterTile, Shelf } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites, useProgress } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Stream Deck" },
      {
        name: "description",
        content: "Continue watching, your favourites and quick access to live TV.",
      },
      { property: "og:title", content: "Home — Stream Deck" },
      { property: "og:description", content: "Pick up where you left off." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { playlists, activeId, active, isLoading } = usePlaylists();
  const progress = useProgress();
  const favorites = useFavorites();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Add your first playlist"
          description="Stream Deck plays your own IPTV subscription. Add an Xtream Codes login or an M3U link and your channels, movies and series appear here."
          action={
            <Button asChild>
              <Link to="/playlists">Add a playlist</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const resumable = (progress.data ?? []).filter(
    (row) => !row.completed && row.positionSeconds > 30 && row.playlistId === activeId,
  );
  const favouriteChannels = (favorites.data ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind === "live",
  );
  const favouriteTitles = (favorites.data ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind !== "live",
  );

  return (
    <div className="space-y-10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watching from {active?.name ?? "your playlist"}
          </p>
        </div>
        <Button asChild>
          <Link to="/live">
            <Tv className="size-4" /> Open Live TV
          </Link>
        </Button>
      </div>

      <Shelf title="Continue watching">
        {progress.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : resumable.length === 0 ? (
          <EmptyState
            title="Nothing to resume yet"
            description="Start a movie or an episode and Stream Deck will remember exactly where you stopped."
          />
        ) : (
          <PosterGrid>
            {resumable.map((row) => (
              <PosterTile
                key={`${row.itemKind}-${row.itemId}`}
                to={row.itemKind === "episode" && row.seriesId ? "/series/$id" : "/movies/$id"}
                params={{
                  id: row.itemKind === "episode" && row.seriesId ? row.seriesId : row.itemId,
                }}
                title={row.title}
                image={row.posterUrl}
                subtitle={
                  row.season != null && row.episode != null
                    ? `S${row.season} E${row.episode}`
                    : row.durationSeconds
                      ? `${Math.round((row.durationSeconds - row.positionSeconds) / 60)} min left`
                      : null
                }
                progress={
                  row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05
                }
              />
            ))}
          </PosterGrid>
        )}
      </Shelf>

      <Shelf
        title="Favourite channels"
        action={
          <Link to="/favorites" className="text-xs font-medium text-primary hover:underline">
            See all
          </Link>
        }
      >
        {favouriteChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Star channels in Live TV to keep them one click away.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favouriteChannels.slice(0, 9).map((row) => (
              <Link
                key={row.id}
                to="/live"
                search={{ channel: row.itemId }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition hover:border-primary/60"
              >
                {row.logoUrl ? (
                  <img src={row.logoUrl} alt="" className="size-9 rounded object-contain" />
                ) : (
                  <span className="grid size-9 place-items-center rounded bg-muted">
                    <Tv className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                <Play className="size-4 text-primary" />
              </Link>
            ))}
          </div>
        )}
      </Shelf>

      <Shelf
        title="Favourite films and shows"
        action={
          <Link to="/favorites" className="text-xs font-medium text-primary hover:underline">
            See all
          </Link>
        }
      >
        {favouriteTitles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Star a movie or series and it will show up here.
          </p>
        ) : (
          <PosterGrid>
            {favouriteTitles.slice(0, 16).map((row) => (
              <PosterTile
                key={row.id}
                to={row.itemKind === "series" ? "/series/$id" : "/movies/$id"}
                params={{ id: row.itemId }}
                title={row.title}
                image={row.logoUrl}
              />
            ))}
          </PosterGrid>
        )}
      </Shelf>
    </div>
  );
}
