import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Search, Star, Tv } from "lucide-react";
import { z } from "zod";

import { getCategories, getItems, getNowNext, getPlayback } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { VideoPlayer } from "@/components/video-player";
import { EmptyState } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isFavorite, useFavorites, useToggleFavorite } from "@/lib/library-hooks";

export const Route = createFileRoute("/_authenticated/live")({
  validateSearch: z.object({ channel: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Live TV — Stream Deck" },
      {
        name: "description",
        content: "Browse your channels by category, see what's on now and watch straight away.",
      },
      { property: "og:title", content: "Live TV — Stream Deck" },
      { property: "og:description", content: "Your channel list with now and next." },
    ],
  }),
  component: LivePage,
});

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LivePage() {
  const { channel: channelFromUrl } = Route.useSearch();
  const { activeId, playlists } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const fetchNowNext = useServerFn(getNowNext);
  const fetchPlayback = useServerFn(getPlayback);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  const favorites = useFavorites();
  const toggle = useToggleFavorite();

  const categories = useQuery({
    queryKey: ["categories", activeId, "live"],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "live" } }),
    enabled: !!activeId && categoryId !== null,
    staleTime: 10 * 60_000,
  });

  const channels = useQuery({
    queryKey: ["items", activeId, "live", categoryId ?? "all", search],
    queryFn: () =>
      fetchItems({
        data: {
          playlistId: activeId!,
          kind: "live",
          categoryId: search ? undefined : categoryId,
          search: search || undefined,
        },
      }),
    enabled: !!activeId,
    staleTime: 5 * 60_000,
  });

  const visible = useMemo(() => (channels.data ?? []).slice(0, 400), [channels.data]);

  const epg = useQuery({
    queryKey: ["nownext", activeId, visible.slice(0, 40).map((item) => item.id).join(",")],
    queryFn: () =>
      fetchNowNext({
        data: { playlistId: activeId!, channelIds: visible.slice(0, 40).map((item) => item.id) },
      }),
    enabled: !!activeId && visible.length > 0,
    staleTime: 5 * 60_000,
  });

  const epgMap = useMemo(
    () => new Map((epg.data ?? []).map((entry) => [entry.channelId, entry])),
    [epg.data],
  );

  // Pick the channel linked from favourites (searched across the whole list,
  // not just the first page shown), otherwise the first channel.
  useEffect(() => {
    const all = channels.data ?? [];
    if (selected || !channelFromUrl || all.length === 0) return;
    if (channelFromUrl) {
      const target = all.find((item) => item.id === channelFromUrl);
      if (target) {
        setSelected(target);
        return;
      }
      // The list may still be loading a filtered view; wait instead of
      // silently playing an unrelated channel.
      if (channels.isFetching) return;
    }
  }, [channels.data, channels.isFetching, channelFromUrl, selected]);

  const playback = useQuery({
    queryKey: ["playback", activeId, "live", selected?.id],
    queryFn: () =>
      fetchPlayback({
        data: { playlistId: activeId!, kind: "live", itemId: selected!.id },
      }),
    enabled: !!activeId && !!selected,
    staleTime: 60_000,
  });

  const step = (direction: 1 | -1) => {
    if (!selected) return;
    const index = visible.findIndex((item) => item.id === selected.id);
    const next = visible[(index + direction + visible.length) % visible.length];
    if (next) setSelected(next);
  };

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No playlist yet"
          description="Add an Xtream login or M3U link and your channels will show up here."
          action={
            <Button asChild>
              <Link to="/playlists">Add a playlist</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const nowNext = selected ? epgMap.get(selected.id) : undefined;

  if (categoryId === null) {
    return (
      <section className="min-h-full p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-2xl font-bold">Live TV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a channel category</p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <Button variant="secondary" className="h-12 justify-start" onClick={() => { setCategoryId(""); setSelected(null); }}>All channels</Button>
            {categories.isLoading
              ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)
              : (categories.data ?? []).map((category) => (
                  <Button key={category.id} variant="secondary" className="h-12 justify-start truncate" onClick={() => { setCategoryId(category.id); setSelected(null); }}>{category.name}</Button>
                ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid h-full gap-0 lg:grid-cols-[minmax(18rem,1fr)_minmax(28rem,1.35fr)]">
      <section className="flex max-h-screen min-w-0 flex-col border-r border-border lg:order-1">
        <div className="border-b border-border p-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setCategoryId(null); }}><ArrowLeft className="size-4" /> Categories</Button>
        </div>
        <div className="relative border-b border-border p-3">
          <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search channels"
            className="pl-9"
          />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {channels.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : channels.isError ? (
            <p className="p-4 text-sm text-destructive">
              {(channels.error as Error).message}
            </p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No channels here.</p>
          ) : (
            visible.map((item) => {
              const entry = epgMap.get(item.id);
              const starred = isFavorite(favorites.data, activeId, "live", item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-center gap-3 border-b border-border/60 px-3 py-2.5",
                    selected?.id === item.id && "bg-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="size-9 shrink-0 rounded object-contain"
                      />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded bg-muted">
                        <Tv className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry?.now
                          ? `${timeLabel(entry.now.start)} ${entry.now.title}`
                          : "No guide data"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={starred ? "Remove from favourites" : "Add to favourites"}
                    onClick={() =>
                      activeId &&
                      toggle.mutate({
                        playlistId: activeId,
                        itemKind: "live",
                        itemId: item.id,
                        title: item.name,
                        logoUrl: item.image,
                      })
                    }
                    className="shrink-0 rounded p-1 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Star
                      className={cn(
                        "size-4",
                        starred ? "fill-primary text-primary" : "text-muted-foreground",
                      )}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="min-w-0 space-y-4 p-4 lg:order-2">
        <VideoPlayer
          src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
          title={selected?.name ?? ""}
          poster={selected?.image ?? null}
          live
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold">
              {selected?.name ?? "Pick a channel"}
            </h1>
            {nowNext?.now && (
              <p className="mt-1 text-sm">
                <span className="text-primary">Now</span> {timeLabel(nowNext.now.start)} ·{" "}
                {nowNext.now.title}
              </p>
            )}
            {nowNext?.next && (
              <p className="text-sm text-muted-foreground">
                Next {timeLabel(nowNext.next.start)} · {nowNext.next.title}
              </p>
            )}
            {nowNext?.now?.description && (
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {nowNext.now.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Previous channel" onClick={() => step(-1)}>
              <ChevronUp className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next channel" onClick={() => step(1)}>
              <ChevronDown className="size-4" />
            </Button>
            {selected && (
              <Button
                variant="outline"
                onClick={() =>
                  activeId &&
                  toggle.mutate({
                    playlistId: activeId,
                    itemKind: "live",
                    itemId: selected.id,
                    title: selected.name,
                    logoUrl: selected.image,
                  })
                }
              >
                <Star
                  className={cn(
                    "size-4",
                    isFavorite(favorites.data, activeId, "live", selected.id) &&
                      "fill-primary text-primary",
                  )}
                />
                Favourite
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
