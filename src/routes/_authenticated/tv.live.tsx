import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { getCategories, getItems, getPlayback } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
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
  const resolve = useServerFn(getPlayback);

  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (selected || channels.length === 0) return;
    const initial = (channel && channels.find((item) => item.id === channel)) || channels[0]!;
    setSelected(initial);
  }, [channels, channel, selected]);

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

  return (
    <TvShell title="Live TV">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          <VideoPlayer
            src={url}
            title={selected?.name ?? ""}
            poster={selected?.image ?? null}
            live
            className="aspect-video w-full overflow-hidden rounded-xl"
          />
          <p className="mt-3 text-2xl font-semibold">{selected?.name ?? "Pick a channel"}</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
            {(categories.data ?? []).slice(0, 30).map((category) => (
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

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {items.isLoading && <p className="text-muted-foreground">Loading channels…</p>}
            {channels.map((item) => (
              <button
                key={item.id}
                type="button"
                data-tv-focus
                onClick={() => setSelected(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-border px-3 py-3 text-left text-lg outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/40",
                  selected?.id === item.id ? "bg-secondary" : "bg-card",
                )}
              >
                {item.image ? (
                  <img src={item.image} alt="" className="size-10 shrink-0 object-contain" />
                ) : (
                  <span className="size-10 shrink-0 rounded bg-muted" />
                )}
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </TvShell>
  );
}
