import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getCategories, getItems } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { EmptyState, PosterGrid, PosterTile } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isFavorite, useFavorites, useProgress, useToggleFavorite } from "@/lib/library-hooks";

const PAGE_SIZE = 60;

export function CatalogBrowser({
  kind,
  title,
  description,
  detailRoute,
}: {
  kind: "movie" | "series";
  title: string;
  description: string;
  detailRoute: "/movies/$id" | "/series/$id";
}) {
  const { activeId, playlists } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);

  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const progress = useProgress();

  const categories = useQuery({
    queryKey: ["categories", activeId, kind],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const items = useQuery({
    queryKey: ["items", activeId, kind, categoryId ?? "all", search],
    queryFn: () =>
      fetchItems({
        data: {
          playlistId: activeId!,
          kind,
          categoryId: search ? undefined : categoryId,
          search: search || undefined,
        },
      }),
    enabled: !!activeId,
    staleTime: 5 * 60_000,
  });

  const shown = useMemo(() => (items.data ?? []).slice(0, page * PAGE_SIZE), [items.data, page]);

  const progressFor = (itemId: string) => {
    const row = (progress.data ?? []).find(
      (entry) =>
        entry.playlistId === activeId &&
        (entry.itemId === itemId || entry.seriesId === itemId) &&
        !entry.completed,
    );
    if (!row) return null;
    return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
  };

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No playlist yet"
          description="Add an Xtream login or M3U link and your library appears here."
          action={
            <Button asChild>
              <Link to="/playlists">Add a playlist</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[14rem_1fr]">
      <aside className="scrollbar-thin hidden max-h-screen overflow-y-auto border-r border-border p-3 lg:block">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Categories
        </p>
        <button
          type="button"
          onClick={() => {
            setCategoryId(undefined);
            setPage(1);
          }}
          className={cn(
            "w-full rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-muted",
            !categoryId && "bg-muted font-medium text-primary",
          )}
        >
          Everything
        </button>
        {categories.isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="my-1.5 h-8 w-full" />
            ))
          : (categories.data ?? []).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(1);
                }}
                className={cn(
                  "w-full truncate rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-muted",
                  categoryId === category.id && "bg-muted font-medium text-primary",
                )}
              >
                {category.name}
              </button>
            ))}
      </aside>

      <section className="min-w-0 space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${kind === "movie" ? "movies" : "series"}`}
              className="pl-9"
            />
          </div>
        </div>

        {items.isLoading ? (
          <PosterGrid>
            {Array.from({ length: 16 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[2/3] w-full" />
            ))}
          </PosterGrid>
        ) : items.isError ? (
          <p className="text-sm text-destructive">{(items.error as Error).message}</p>
        ) : shown.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="This category is empty, or your provider does not offer this kind of content."
          />
        ) : (
          <>
            <PosterGrid>
              {shown.map((item) => (
                <PosterTile
                  key={item.id}
                  to={detailRoute}
                  params={{ id: item.id }}
                  title={item.name}
                  image={item.image}
                  subtitle={item.year}
                  progress={progressFor(item.id)}
                  favorite={isFavorite(favorites.data, activeId, kind, item.id)}
                  onToggleFavorite={() =>
                    activeId &&
                    toggle.mutate({
                      playlistId: activeId,
                      itemKind: kind,
                      itemId: item.id,
                      title: item.name,
                      logoUrl: item.image,
                    })
                  }
                />
              ))}
            </PosterGrid>
            {shown.length < (items.data ?? []).length && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setPage((value) => value + 1)}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
