import { useGetCategories, useGetItems, useGetNowNext, useGetPlayback } from "@/lib/device-provider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Star, Tv } from "lucide-react";
import { z } from "zod";

import { getCategories, getItems, getNowNext, getPlayback } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { VideoPlayer } from "@/components/video-player";
import { EmptyState } from "@/components/media";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { compareTitles, isFavorite, useFavorites, useToggleFavorite } from "@/lib/library-hooks";
import { useLongPress } from "@/lib/use-long-press";
import { toast } from "sonner";
import { MultiView } from "@/components/multi-view";
import { FAVOURITES_CATEGORY, RECENT_CATEGORY, orderByRecent, useRecentChannels, useTouchRecent } from "@/lib/recent-channels";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LivePage,
});

/** A category in the chooser: quick press opens it, hold stars it. */
function CategoryPickButton({
  category,
  starred,
  onOpen,
  onToggleFavorite,
}: {
  category: { id: string; name: string };
  starred: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const longPress = useLongPress(onToggleFavorite);
  return (
    <Button
      data-tv-focus
      variant="ghost"
      className="h-12 justify-start truncate px-4 text-base"
      title={`${category.name} — hold to ${starred ? "remove from" : "add to"} favourite categories`}
      onClick={onOpen}
      {...longPress}
    >
      {starred && <Star className="size-4 shrink-0 fill-primary text-primary" />}
      {category.name}
    </Button>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChannelRow({
  item,
  entry,
  starred,
  onSelect,
  onToggleFavorite,
  selected,
}: {
  item: CatalogItem;
  entry: { now: { start: string | null; title: string } | null } | undefined;
  starred: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const longPress = useLongPress(onToggleFavorite);
  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-border/60 px-3 py-2.5",
        selected && "bg-muted",
      )}
    >
      <button
        type="button"
        data-tv-focus
        onClick={onSelect}
        title={`${item.name} — press and hold to ${starred ? "remove from" : "add to"} favourites`}
        {...longPress}
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
        onClick={onToggleFavorite}
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
}

function LivePage() {
  const navigate = useNavigate();
  const { channel: channelFromUrl } = Route.useSearch();
  const { activeId, playlists } = usePlaylists();
  const fetchCategories = useGetCategories();
  const fetchItems = useGetItems();
  const fetchNowNext = useGetNowNext();
  const fetchPlayback = useGetPlayback();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  const favorites = useFavorites();
  const recent = useRecentChannels(activeId);
  const touchRecent = useTouchRecent();
  const [multiOpen, setMultiOpen] = useState(false);
  useEffect(() => {
    if (selected) touchRecent(activeId, selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  const isRecent = categoryId === RECENT_CATEGORY;
  const isFavourites = categoryId === FAVOURITES_CATEGORY;
  const toggle = useToggleFavorite();

  // The category list opens with focus on Favourites for accounts that have
  // favourite channels, so the remote or mouse starts on their own list.
  const focusedFavourites = useRef(false);
  useEffect(() => {
    if (focusedFavourites.current || categoryId !== null || favorites.isLoading || !activeId) return;
    focusedFavourites.current = true;
    const hasFavouriteChannels = (favorites.data ?? []).some(
      (row) => row.playlistId === activeId && row.itemKind === "live",
    );
    if (!hasFavouriteChannels) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-focus-key="live-category-favourites"]')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categoryId, favorites.isLoading, favorites.data, activeId]);

  const categories = useQuery({
    queryKey: ["categories", activeId, "live"],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "live" } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const channels = useQuery({
    queryKey: ["items", activeId, "live", isRecent || isFavourites ? "all" : (categoryId ?? "all"), search],
    queryFn: () =>
      fetchItems({
        data: {
          playlistId: activeId!,
          kind: "live",
          categoryId: search || isRecent || isFavourites ? undefined : (categoryId || undefined),
          search: search || undefined,
        },
      }),
    enabled: !!activeId,
    staleTime: 5 * 60_000,
  });

  const visible = useMemo(
    () => {
      if (isFavourites && !search) {
        const ids = new Set((favorites.data ?? []).filter((row) => row.playlistId === activeId && row.itemKind === "live").map((row) => row.itemId));
        return (channels.data ?? []).filter((item) => ids.has(item.id)).sort((a, b) => compareTitles(a.name, b.name)).slice(0, 400);
      }
      return (isRecent && !search ? orderByRecent(channels.data ?? [], recent.rows) : (channels.data ?? [])).slice(0, 400);
    },
    [channels.data, isRecent, isFavourites, search, recent.rows, favorites.data, activeId],
  );

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

  const toggleChannel = (item: CatalogItem) => {
    if (!activeId) return;
    const starred = isFavorite(favorites.data, activeId, "live", item.id);
    toggle.mutate(
      { playlistId: activeId, itemKind: "live", itemId: item.id, title: item.name, logoUrl: item.image },
      { onSuccess: () => toast.success(starred ? `Removed ${item.name} from favourites` : `Added ${item.name} to favourites`) },
    );
  };

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
      <section data-tv-zone="categories" className="min-h-full animate-slide-in-right p-4 motion-reduce:animate-none sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Button data-layer-back data-tv-focus variant="ghost" className="mb-3" onClick={() => void navigate({ to: "/dashboard" })}><ArrowLeft className="size-4" /> Home</Button>
          <h1 className="font-display text-2xl font-bold">Live TV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a channel category</p>
          <div className="mt-5 flex flex-col gap-1">
            <Button data-tv-focus data-focus-key="live-category-favourites" variant="ghost" className="h-12 justify-start px-4 text-base" onClick={() => { setCategoryId(FAVOURITES_CATEGORY); setSelected(null); }}><Star className="size-4" /> Favourites</Button>
            {recent.rows.length > 0 && (
              <Button data-tv-focus variant="ghost" className="h-12 justify-start px-4 text-base" onClick={() => { setCategoryId(RECENT_CATEGORY); setSelected(null); }}>Recent</Button>
            )}
            <Button data-tv-focus variant="ghost" className="h-12 justify-between px-4 text-base" onClick={() => { setCategoryId(""); setSelected(null); }}>All channels</Button>
            {categories.isLoading
              ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)
              : (categories.data ?? []).map((category) => (
                  <Button key={category.id} data-tv-focus variant="ghost" className="h-12 justify-start truncate px-4 text-base" onClick={() => { setCategoryId(category.id); setSelected(null); }}>{category.name}</Button>
                ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div data-tv-zone="content" className="grid h-full animate-slide-in-right gap-0 motion-reduce:animate-none lg:grid-cols-[minmax(18rem,1fr)_minmax(28rem,1.35fr)]">
      <section className="flex max-h-screen min-w-0 flex-col border-r border-border lg:order-1">
        <div className="border-b border-border p-3">
          <Button data-layer-back data-tv-focus variant="ghost" size="sm" onClick={() => { setSelected(null); setCategoryId(null); }}><ArrowLeft className="size-4" /> Categories</Button>
        </div>
        <div className="relative border-b border-border p-3">
          <SearchField
            value={search}
            onValueChange={setSearch}
            placeholder="Search channels"
            data-tv-focus data-app-search="true"
          />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {channels.isLoading || (isFavourites && favorites.isLoading) ? (
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
            <p className="p-4 text-sm text-muted-foreground">{isFavourites ? "No favourite channels in this playlist yet." : "No channels here."}</p>
          ) : (
            visible.map((item) => (
              <ChannelRow
                key={item.id}
                item={item}
                entry={epgMap.get(item.id)}
                starred={isFavorite(favorites.data, activeId, "live", item.id)}
                selected={selected?.id === item.id}
                onSelect={() => setSelected(item)}
                onToggleFavorite={() => toggleChannel(item)}
              />
            ))
          )}
        </div>
      </section>

      <section className="order-first min-w-0 space-y-4 p-4 lg:order-2">
        <VideoPlayer
          src={playback.data?.url ?? null}
            fallbackSrc={playback.data?.directUrl ?? null}
          onRefreshSource={() => playback.refetch()}
          title={selected?.name ?? ""}
          poster={selected?.image ?? null}
          live
          className="mx-auto max-h-[30vh] max-w-xl"
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
            <Button variant="outline" disabled={channels.isFetching} onClick={() => void Promise.all([channels.refetch(), playback.refetch()]).then(() => toast.success("Channels updated"))}>
              {channels.isFetching ? "Updating…" : "Update channels"}
            </Button>
            <Button variant="outline" onClick={() => setMultiOpen(true)}>Multi-view</Button>
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
      <MultiView
        open={multiOpen}
        playlistId={activeId}
        initial={selected}
        candidates={[
          ...orderByRecent(channels.data ?? [], recent.rows),
          ...(channels.data ?? []).filter((item) => isFavorite(favorites.data, activeId, "live", item.id)),
          ...visible,
        ]}
        onClose={() => setMultiOpen(false)}
      />
    </div>
  );
}
