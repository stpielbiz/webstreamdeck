import { createFileRoute } from "@tanstack/react-router";
import { CatalogWorkspace } from "@/components/catalog-workspace";
import { TvShell } from "@/components/tv-shell";

export const Route = createFileRoute("/_authenticated/tv/movies")({
  head: () => ({
    meta: [
      { title: "Movies on your TV — Stream Deck" },
      {
        name: "description",
        content: "Browse your movie library with the remote and pick up where you left off.",
      },
      { property: "og:title", content: "Movies on your TV — Stream Deck" },
      { property: "og:description", content: "Big-screen movie library." },
    ],
  }),
  component: TvMovies,
});

function TvMovies() {
  return (
    <TvShell title="Movies">
      <CatalogWorkspace kind="movie" tv />
    </TvShell>
  );
}
