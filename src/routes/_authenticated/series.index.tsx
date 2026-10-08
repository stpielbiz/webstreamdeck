import { createFileRoute } from "@tanstack/react-router";

import { CatalogBrowser } from "@/components/catalog-browser";
import { CatalogLoading } from "@/components/catalog-loading";

export const Route = createFileRoute("/_authenticated/series/")({
  head: () => ({
    meta: [
      { title: "Series — Stream Deck" },
      {
        name: "description",
        content: "Browse shows in your playlist, open seasons and episode lists, and resume any episode.",
      },
      { property: "og:title", content: "Series — Stream Deck" },
      { property: "og:description", content: "Seasons and episodes from your own playlist." },
    ],
  }),
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: () => <CatalogLoading title="Shows" />,
  component: SeriesPage,
});

function SeriesPage() {
  return (
    <CatalogBrowser
      kind="series"
      title="Series"
      description="Shows grouped into seasons and episodes."
      detailRoute="/series/$id"
    />
  );
}
