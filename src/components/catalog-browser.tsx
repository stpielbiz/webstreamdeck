import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { LayoutGrid, Rows3, Search } from "lucide-react";

import { getCategories, getItems } from "@/lib/iptv.functions";
import { usePlaylists } from "@/components/playlist-context";
import { EmptyState, PosterGrid, PosterTile, Shelf } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { buildGenreIndex, groupItems, type GroupBy } from "@/lib/organize";
import { isFavorite, useFavorites, useProgress, useToggleFavorite } from "@/lib/library-hooks";

const PAGE_SIZE = 60;
const ROW_SIZE = 20;

const GROUPINGS: { value: GroupBy; label: string }[] = [
  { value: "genre", label: "Type" },
  { value: "year", label: "Year" },
  { value: "alphabet", label: "A–Z" },
];

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
  const [view, setView] = useState<"rows" | "grid">("rows");
  const [groupBy, setGroupBy] = useState<GroupBy>("genre");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const groups = useMemo(
    () => groupItems(items.data ?? [], categories.data ?? [], groupBy),
    [items.data, categories.data, groupBy],
  );

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

  const tileFor = (item: (typeof shown)[number]) => (
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
  );

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
          <div className="min-w-0">
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Organise by
          </span>
          {GROUPINGS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setGroupBy(option.value);
                setView("rows");
                setExpanded(null);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                view === "rows" && groupBy === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-secondary p-1">
            <button
              type="button"
              onClick={() => setView("rows")}
              aria-label="Grouped rows"
              className={cn(
                "rounded-md p-1.5 transition",
                view === "rows" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Rows3 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="All in one grid"
              className={cn(
                "rounded-md p-1.5 transition",
                view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
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
        ) : (items.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="This category is empty, or your provider does not offer this kind of content."
          />
        ) : view === "rows" ? (
          <div className="space-y-8">
            {groups.map((group) => {
              const isOpen = expanded === group.key;
              return (
                <Shelf
                  key={group.key}
                  title={`${group.label} · ${group.items.length}`}
                  action={
                    group.items.length > ROW_SIZE && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : group.key)}
                      >
                        {isOpen ? "Show less" : "See all"}
                      </Button>
                    )
                  }
                >
                  {isOpen ? (
                    <PosterGrid>{group.items.slice(0, 240).map(tileFor)}</PosterGrid>
                  ) : (
                    <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                      {group.items.slice(0, ROW_SIZE).map((item) => (
                        <div key={item.id} className="w-28 shrink-0 sm:w-32 md:w-36">
                          {tileFor(item)}
                        </div>
                      ))}
                    </div>
                  )}
                </Shelf>
              );
            })}
          </div>
        ) : (
          <>
            <PosterGrid>{shown.map(tileFor)}</PosterGrid>
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
