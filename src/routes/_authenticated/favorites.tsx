import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Star, Tv } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { usePlaylists } from "@/components/playlist-context";
import { EmptyState, PosterGrid, PosterTile, Shelf } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites, useToggleFavorite } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favourites — Stream Deck" },
      {
        name: "description",
        content: "The channels, films and shows you starred, ready to play in one click.",
      },
      { property: "og:title", content: "Favourites — Stream Deck" },
      { property: "og:description", content: "Everything you starred, in one place." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const navigate = useNavigate();
  const { activeId, playlists } = usePlaylists();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No playlist yet"
          description="Add a playlist first, then star the channels and titles you watch most."
          action={
            <Button asChild>
              <Link to="/playlists">Add a playlist</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (favorites.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const rows = (favorites.data ?? []).filter((row) => row.playlistId === activeId);
  const channels = rows.filter((row) => row.itemKind === "live");
  const films = rows.filter((row) => row.itemKind === "movie");
  const shows = rows.filter((row) => row.itemKind === "series");

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No favourites yet"
          description="Tap the star on a channel, film or show and it will appear here."
          action={
            <Button asChild>
              <Link to="/live">Browse live TV</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-tv-zone="content" className="space-y-10 p-6">
      <Button data-layer-back data-tv-focus variant="ghost" onClick={() => void navigate({ to: "/dashboard" })}><ArrowLeft className="size-4" /> Home</Button>
      <h1 className="font-display text-2xl font-bold">Favourites</h1>

      {channels.length > 0 && (
        <Shelf title="Channels">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                {row.logoUrl ? (
                  <img src={row.logoUrl} alt="" className="size-9 rounded object-contain" />
                ) : (
                  <span className="grid size-9 place-items-center rounded bg-muted">
                    <Tv className="size-4 text-muted-foreground" />
                  </span>
                )}
                <Link
                  to="/live"
                  search={{ channel: row.itemId }}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                >
                  {row.title}
                </Link>
                <Link to="/live" search={{ channel: row.itemId }} aria-label={`Watch ${row.title}`}>
                  <Play className="size-4 text-primary" />
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${row.title} from favourites`}
                  onClick={() =>
                    activeId &&
                    toggle.mutate({
                      playlistId: activeId,
                      itemKind: "live",
                      itemId: row.itemId,
                      title: row.title,
                      logoUrl: row.logoUrl,
                    })
                  }
                >
                  <Star className="size-4 fill-primary text-primary" />
                </button>
              </div>
            ))}
          </div>
        </Shelf>
      )}

      {films.length > 0 && (
        <Shelf title="Movies">
          <PosterGrid>
            {films.map((row) => (
              <PosterTile
                key={row.id}
                to="/movies/$id"
                params={{ id: row.itemId }}
                title={row.title}
                image={row.logoUrl}
                favorite
                onToggleFavorite={() =>
                  activeId &&
                  toggle.mutate({
                    playlistId: activeId,
                    itemKind: "movie",
                    itemId: row.itemId,
                    title: row.title,
                    logoUrl: row.logoUrl,
                  })
                }
              />
            ))}
          </PosterGrid>
        </Shelf>
      )}

      {shows.length > 0 && (
        <Shelf title="Series">
          <PosterGrid>
            {shows.map((row) => (
              <PosterTile
                key={row.id}
                to="/series/$id"
                params={{ id: row.itemId }}
                title={row.title}
                image={row.logoUrl}
                favorite
                onToggleFavorite={() =>
                  activeId &&
                  toggle.mutate({
                    playlistId: activeId,
                    itemKind: "series",
                    itemId: row.itemId,
                    title: row.title,
                    logoUrl: row.logoUrl,
                  })
                }
              />
            ))}
          </PosterGrid>
        </Shelf>
      )}
    </div>
  );
}
