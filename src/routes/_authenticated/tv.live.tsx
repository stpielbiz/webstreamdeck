import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Tv } from "lucide-react";
import { z } from "zod";

import { getCategories, getItems, getNowNext, getPlayback } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tv/live")({
  validateSearch: z.object({ channel: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Live TV on your TV — Stream Deck" },
      {
        name: "description",
        content: "Browse channels with your remote and watch live TV full screen.",
      },
      { property: "og:title", content: "Live TV on your TV — Stream Deck" },
      { property: "og:description", content: "Remote-friendly channel list and player." },
    ],
  }),
  component: TvLive,
});

function TvLive() {
  const { channel } = Route.useSearch();
  const { activeId } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const fetchNowNext = useServerFn(getNowNext);
  const resolve = useServerFn(getPlayback);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ["tv-live-categories", activeId],
    queryFn: () => fetchCategories({ data: { playlistId: activeId!, kind: "live" } }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const items = useQuery({
    queryKey: ["tv-live-items", activeId, categoryId],
    queryFn: () =>
      fetchItems({
        data: { playlistId: activeId!, kind: "live", ...(categoryId ? { categoryId } : {}) },
      }),
    enabled: !!activeId,
    staleTime: 10 * 60_000,
  });

  const channels = useMemo(() => items.data ?? [], [items.data]);
  const focusedIndex = Math.max(
    0,
    channels.findIndex((item) => item.id === focusedId),
  );
  const guideChannels = useMemo(() => {
    const start = Math.max(0, Math.min(focusedIndex - 20, Math.max(0, channels.length - 60)));
    return channels.slice(start, start + 60);
  }, [channels, focusedIndex]);

  const guide = useQuery({
    queryKey: ["tv-live-guide", activeId, guideChannels.map((item) => item.id).join(",")],
    queryFn: () =>
      fetchNowNext({
        data: { playlistId: activeId!, channelIds: guideChannels.map((item) => item.id) },
      }),
    enabled: !!activeId && guideChannels.length > 0,
    staleTime: 5 * 60_000,
  });

  const guideMap = useMemo(
    () => new Map((guide.data ?? []).map((entry) => [entry.channelId, entry])),
    [guide.data],
  );

  useEffect(() => {
    if (selected || !channel || channels.length === 0) return;
    const initial = channels.find((item) => item.id === channel);
    if (!initial) return;
    setSelected(initial);
    setFocusedId(initial.id);
  }, [channels, channel, selected]);

  useEffect(() => {
    if (channels.length === 0) {
      setFocusedId(null);
      return;
    }
    if (!focusedId || !channels.some((item) => item.id === focusedId)) {
      setFocusedId(channels[0]?.id ?? null);
    }
  }, [channels, focusedId]);

  useEffect(() => {
    if (!activeId || !selected) return;
    let cancelled = false;
    setUrl(null);
    setDirectUrl(null);
    void resolve({ data: { playlistId: activeId, kind: "live", itemId: selected.id } })
      .then((result) => {
        if (cancelled) return;
        setUrl(result.url);
        setDirectUrl(result.directUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, selected, resolve]);

  const focused = channels.find((item) => item.id === focusedId) ?? selected;
  const focusedGuide = focused ? guideMap.get(focused.id) : undefined;

  return (
    <TvShell
      title="Live TV"
      immersive
      onBack={
        categoryId !== null
            ? () => setCategoryId(null)
            : () => void window.history.back()
      }
    >
      {categoryId === null ? (
        <div data-tv-zone="categories" className="scrollbar-thin mx-auto h-full max-w-3xl animate-slide-in-right overflow-y-auto py-2 motion-reduce:animate-none">
          <h2 className="mb-4 text-2xl font-semibold">Choose a channel category</h2>
          <div className="flex flex-col gap-1">
            <Button data-tv-focus variant="ghost" className="h-14 justify-start truncate px-4 text-lg" onClick={() => { setCategoryId(""); setSelected(null); }}>All channels</Button>
            {(categories.data ?? []).map((category) => (
              <Button key={category.id} data-tv-focus variant="ghost" className="h-14 justify-start truncate px-4 text-lg" onClick={() => { setCategoryId(category.id); setSelected(null); }}>{category.name}</Button>
            ))}
          </div>
        </div>
      ) : (
      <div data-tv-zone="content" className="flex h-full min-h-0 animate-slide-in-right flex-col gap-2 motion-reduce:animate-none sm:gap-3">
        <section className="grid shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(22rem,42%)]">
          <div className="min-w-0 self-center py-1 md:order-1">
            <Button data-layer-back data-tv-focus variant="ghost" className="mb-2" onClick={() => { setSelected(null); setCategoryId(null); }}>
              <ArrowLeft className="size-4" /> Categories
            </Button>
            <div className="mb-1 flex min-w-0 items-center gap-3">
              {focused?.image ? (
                <img src={focused.image} alt="" className="size-12 shrink-0 object-contain sm:size-16" />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded bg-muted sm:size-16"><Tv className="size-6 text-muted-foreground" /></span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-primary">Live now</p>
                <h2 className="truncate font-display text-xl font-bold sm:text-3xl">{focusedGuide?.now?.title ?? focused?.name ?? "Choose a channel"}</h2>
              </div>
            </div>
            <p className="truncate text-sm font-semibold text-muted-foreground sm:text-lg">{focused?.name}</p>
            {focusedGuide?.now?.description && <p className="mt-1 line-clamp-2 max-w-4xl text-sm text-muted-foreground sm:text-base">{focusedGuide.now.description}</p>}
            {focused && selected?.id !== focused.id && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary"><Play className="size-4 fill-current" /> Press OK to watch</p>}
          </div>
          <div className="order-first max-h-[32vh] min-h-0 md:order-2 md:max-h-none">
          <VideoPlayer
            src={url}
            fallbackSrc={directUrl}
            title={selected?.name ?? ""}
            poster={selected?.image ?? null}
            live
            className="aspect-video h-full max-h-[32vh] w-full overflow-hidden rounded-lg"
          />
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border" aria-label="Channel guide">
          <div className="hidden shrink-0 grid-cols-[4rem_minmax(14rem,1.25fr)_minmax(16rem,2fr)_minmax(14rem,1.5fr)] border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground sm:grid">
            <span>Channel</span>
            <span>Name</span>
            <span>On now</span>
            <span>Up next</span>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {items.isLoading && <p className="p-6 text-center text-muted-foreground">Loading channels…</p>}
            {!items.isLoading && channels.length === 0 && (
              <p className="p-6 text-center text-muted-foreground">No channels in this category.</p>
            )}
            {channels.map((item, index) => {
              const entry = guideMap.get(item.id);
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  data-tv-focus
                  onFocus={() => setFocusedId(item.id)}
                  onClick={() => {
                    setFocusedId(item.id);
                    setSelected(item);
                  }}
                  className={cn(
                    "group grid h-auto min-h-16 w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-2 rounded-none border-b border-border/60 px-3 py-2 text-left transition sm:grid-cols-[4rem_minmax(14rem,1.25fr)_minmax(16rem,2fr)_minmax(14rem,1.5fr)] sm:gap-x-3",
                    "focus-visible:relative focus-visible:z-10 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary",
                    selected?.id === item.id && focusedId !== item.id && "bg-secondary",
                  )}
                >
                  <span className="text-center text-base tabular-nums text-muted-foreground group-focus-visible:text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt="" loading="lazy" className="size-10 shrink-0 object-contain" />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded bg-muted">
                        <Tv className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold sm:text-lg">{item.name}</span>
                      <span className="block truncate text-sm font-normal text-muted-foreground group-focus-visible:text-primary-foreground/80 sm:hidden">
                        {entry?.now?.title ?? "No programme information"}
                      </span>
                    </span>
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-base font-semibold">
                      {entry?.now?.title ?? "No programme information"}
                    </span>
                    {entry?.now?.start && (
                      <span className="block text-sm font-normal text-muted-foreground group-focus-visible:text-primary-foreground/80">
                        {timeLabel(entry.now.start)} – {timeLabel(entry.now.end)}
                      </span>
                    )}
                  </span>
                  <span className="hidden truncate text-base font-normal text-muted-foreground group-focus-visible:text-primary-foreground/80 sm:block">
                    {entry?.next?.title ?? "No programme information"}
                  </span>
                </Button>
              );
            })}
          </div>
        </section>
      </div>
      )}
    </TvShell>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
