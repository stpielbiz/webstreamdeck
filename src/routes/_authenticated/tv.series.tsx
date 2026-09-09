import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getCategories, getItems } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { cn } from "@/lib/utils";

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
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const categories = useQuery({
    queryKey: ["tv-series-categories", activeId],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "series" } }),
    enabled: !!activeId,
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
    <TvShell title="Series">
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          data-tv-focus
          onClick={() => setCategoryId(undefined)}
          className={cn(
            "rounded-lg px-4 py-2 text-base font-medium outline-none focus:ring-4 focus:ring-primary/40",
            categoryId ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          All
        </button>
        {(categories.data ?? []).slice(0, 24).map((category) => (
          <button
            key={category.id}
            type="button"
            data-tv-focus
            onClick={() => setCategoryId(category.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-base font-medium outline-none focus:ring-4 focus:ring-primary/40",
              categoryId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

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
            onSelect={() => void navigate({ to: "/series/$id", params: { id: item.id } })}
          />
        ))}
      </TvGrid>
    </TvShell>
  );
}
