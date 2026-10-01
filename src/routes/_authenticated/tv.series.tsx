import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getCategories, getItems } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";

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
  component: TvSeries,
});

function TvSeries() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ["tv-series-categories", activeId],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "series" } }),
    enabled: !!activeId && categoryId !== null,
    staleTime: 10 * 60_000,
  });

  const items = useQuery({
    queryKey: ["tv-series-items", activeId, categoryId],
    queryFn: () =>
      fetchItems({
        data: { playlistId: activeId!, kind: "series", ...(categoryId ? { categoryId } : {}) },
      }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  return (
    <TvShell title="Series" onBack={categoryId !== null ? () => setCategoryId(null) : undefined}>
      {categoryId === null ? (
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-semibold">Choose a show category</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Button data-tv-focus variant="secondary" className="h-14 justify-start text-lg" onClick={() => setCategoryId("")}>All shows</Button>
            {(categories.data ?? []).map((category) => (
              <Button key={category.id} data-tv-focus variant="secondary" className="h-14 justify-start truncate text-lg" onClick={() => setCategoryId(category.id)}>{category.name}</Button>
            ))}
          </div>
        </div>
      ) : <>
      <Button data-tv-focus variant="ghost" className="mb-4" onClick={() => setCategoryId(null)}>Back to categories</Button>

      {items.isLoading && <p className="text-xl text-muted-foreground">Loading series…</p>}
      {items.isError && (
        <p className="text-xl text-destructive">Your provider did not answer. Try again shortly.</p>
      )}

      <TvGrid>
        {(items.data ?? []).slice(0, 90).map((item) => (
          <TvTile
            key={item.id}
            title={item.name}
            image={item.image}
            subtitle={item.year ?? null}
            onSelect={() =>
              void navigate({ to: "/tv/watch/series/$id", params: { id: item.id } })
            }
          />
        ))}
      </TvGrid>
      </>}
    </TvShell>
  );
}
