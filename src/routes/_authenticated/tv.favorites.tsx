import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { usePlaylists } from "@/components/playlist-context";
import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/tv/favorites")({
  head: () => ({
    meta: [
      { title: "Favourites on your TV — Stream Deck" },
      {
        name: "description",
        content: "Your starred channels, movies and series, ready to open with the remote.",
      },
      { property: "og:title", content: "Favourites on your TV — Stream Deck" },
      { property: "og:description", content: "Everything you starred, on the big screen." },
    ],
  }),
  component: TvFavorites,
});

function TvFavorites() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const { data: favorites, isLoading } = useFavorites();

  const rows = (favorites ?? []).filter((row) => row.playlistId === activeId);
  const groups = [
    { key: "live", label: "Channels" },
    { key: "movie", label: "Movies" },
    { key: "series", label: "Series" },
  ] as const;

  return (
    <TvShell title="Favourites">
      <Button data-layer-back data-tv-focus variant="ghost" className="mb-4" onClick={() => void navigate({ to: "/tv" })}><ArrowLeft className="size-4" /> Sections</Button>
      {isLoading && <p className="text-xl text-muted-foreground">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-xl text-muted-foreground">
          Nothing starred yet. Star a channel, movie or series and it shows up here.
        </p>
      )}

      {groups.map((group) => {
        const items = rows.filter((row) => row.itemKind === group.key);
        if (items.length === 0) return null;
        return (
          <section key={group.key} className="mb-10">
            <h2 className="mb-4 text-2xl font-semibold">{group.label}</h2>
            <TvGrid>
              {items.map((row) => (
                <TvTile
                  key={row.id}
                  title={row.title}
                  image={row.logoUrl}
                  onSelect={() =>
                    void navigate(
                      group.key === "live"
                        ? { to: "/tv/live", search: { channel: row.itemId } }
                        : group.key === "movie"
                          ? { to: "/tv/watch/movie/$id", params: { id: row.itemId }, search: { from: "favorites" } }
                          : { to: "/tv/watch/series/$id", params: { id: row.itemId }, search: { from: "favorites" } },
                    )
                  }
                />
              ))}
            </TvGrid>
          </section>
        );
      })}
    </TvShell>
  );
}
