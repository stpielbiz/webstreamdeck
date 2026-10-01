import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getCategories, getItems } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { useProgress } from "@/lib/library-hooks";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const { data: progress } = useProgress();
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ["tv-movie-categories", activeId],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "movie" } }),
    enabled: !!activeId && categoryId !== null,
    staleTime: 10 * 60_000,
  });

  const items = useQuery({
    queryKey: ["tv-movie-items", activeId, categoryId],
    queryFn: () =>
      fetchItems({
        data: { playlistId: activeId!, kind: "movie", ...(categoryId ? { categoryId } : {}) },
      }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  return (
    <TvShell title="Movies" onBack={categoryId !== null ? () => setCategoryId(null) : undefined}>
      {categoryId === null ? (
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-semibold">Choose a movie category</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Button data-tv-focus variant="secondary" className="h-14 justify-start text-lg" onClick={() => setCategoryId("")}>All movies</Button>
            {(categories.data ?? []).map((category) => (
              <Button key={category.id} data-tv-focus variant="secondary" className="h-14 justify-start truncate text-lg" onClick={() => setCategoryId(category.id)}>{category.name}</Button>
            ))}
          </div>
        </div>
      ) : <>
      <Button data-tv-focus variant="ghost" className="mb-4" onClick={() => setCategoryId(null)}>Back to categories</Button>

      {items.isLoading && <p className="text-xl text-muted-foreground">Loading movies…</p>}
      {items.isError && (
        <p className="text-xl text-destructive">Your provider did not answer. Try again shortly.</p>
      )}

      <TvGrid>
        {(items.data ?? []).slice(0, 90).map((item) => {
          const row = (progress ?? []).find(
            (entry) => entry.itemId === item.id && entry.playlistId === activeId,
          );
          return (
            <TvTile
              key={item.id}
              title={item.name}
              image={item.image}
              subtitle={item.year ?? null}
              progress={
                row?.durationSeconds ? row.positionSeconds / row.durationSeconds : null
              }
              onSelect={() =>
                void navigate({ to: "/tv/watch/movie/$id", params: { id: item.id } })
              }
            />
          );
        })}
      </TvGrid>
      </>}
    </TvShell>
  );
}
