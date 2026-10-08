import { createFileRoute } from "@tanstack/react-router";
import { CatalogWorkspace } from "@/components/catalog-workspace";
import { CatalogLoading } from "@/components/catalog-loading";
import { TvShell } from "@/components/tv-shell";

export const Route = createFileRoute("/_authenticated/tv/series")({
  head: () => ({
    meta: [
      { title: "Series on your TV — Stream Deck" },
      {
        name: "description",
        content: "Browse your series with the remote, pick a season and carry on watching.",
      },
      { property: "og:title", content: "Series on your TV — Stream Deck" },
      { property: "og:description", content: "Big-screen series library." },
    ],
  }),
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: () => <CatalogLoading title="Shows" tv />,
  component: TvSeries,
});

function TvSeries() {
  return (
    <TvShell title="Series">
      <CatalogWorkspace kind="series" tv />
    </TvShell>
  );
}
