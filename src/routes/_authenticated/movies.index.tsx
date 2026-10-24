import { createFileRoute } from "@tanstack/react-router";

import { CatalogBrowser } from "@/components/catalog-browser";
import { CatalogLoading } from "@/components/catalog-loading";

export const Route = createFileRoute("/_authenticated/movies/")({
  head: () => ({
    meta: [
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
      { title: "Movies — Jolzplay" },
      {
        name: "description",
        content: "Browse the films in your playlist by category, search them and pick up where you stopped.",
      },
      { property: "og:title", content: "Movies — Jolzplay" },
      { property: "og:description", content: "Your playlist's film library, organised." },
    ],
  }),
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: () => <CatalogLoading title="Movies" />,
  component: MoviesPage,
});

function MoviesPage() {
  return (
    <CatalogBrowser
      kind="movie"
      title="Movies"
      description="Everything your provider lists as a film."
      detailRoute="/movies/$id"
    />
  );
}
