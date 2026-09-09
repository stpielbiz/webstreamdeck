import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { usePlaylists } from "@/components/playlist-context";
import { useFavorites, useProgress } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/tv/")({
  head: () => ({
    meta: [
      { title: "TV mode — Stream Deck" },
      {
        name: "description",
        content: "Big-screen TV mode: carry on watching, jump into live TV, movies and series.",
      },
      { property: "og:title", content: "TV mode — Stream Deck" },
      { property: "og:description", content: "Remote-friendly big screen view of your playlists." },
    ],
  }),
  component: TvHome,
});

function TvHome() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const { data: progress } = useProgress();
  const { data: favorites } = useFavorites();

  const resume = (progress ?? []).filter(
    (row) => row.playlistId === activeId && !row.completed && row.positionSeconds > 30,
  );
  const favouriteChannels = (favorites ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind === "live",
  );

  return (
    <TvShell title="Home">
      {!activeId && (
        <p className="text-xl text-muted-foreground">
          No playlist yet. Add one on your phone or computer, then come back here.
        </p>
      )}

      {resume.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold">Carry on watching</h2>
          <TvGrid>
            {resume.slice(0, 12).map((row) => (
              <TvTile
                key={`${row.itemKind}-${row.itemId}`}
                title={row.title}
                image={row.posterUrl}
                subtitle={row.itemKind === "episode" ? `S${row.season} E${row.episode}` : null}
                progress={
                  row.durationSeconds ? row.positionSeconds / row.durationSeconds : null
                }
                onSelect={() =>
                  void navigate(
                    row.itemKind === "episode" && row.seriesId
                      ? { to: "/series/$id", params: { id: row.seriesId } }
                      : { to: "/movies/$id", params: { id: row.itemId } },
                  )
                }
              />
            ))}
          </TvGrid>
        </section>
      )}

      {favouriteChannels.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-semibold">Favourite channels</h2>
          <TvGrid>
            {favouriteChannels.slice(0, 12).map((row) => (
              <TvTile
                key={row.id}
                title={row.title}
                image={row.logoUrl}
                onSelect={() =>
                  void navigate({ to: "/tv/live", search: { channel: row.itemId } })
                }
              />
            ))}
          </TvGrid>
        </section>
      )}
    </TvShell>
  );
}
