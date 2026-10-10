import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GUIDE_TTL, guideKey, mergeGuide, type GuideStore } from "@/lib/library-sync";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Search, Tv, X } from "lucide-react";
import { z } from "zod";

import { getCategories, getItems, getPlayback, getSchedules } from "@/lib/iptv.functions";
import type { CatalogItem, Programme } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";
import { useAppSearchFocus } from "@/lib/app-search";

const GUIDE_HOURS = 12;
const GUIDE_WIDTH = 2880;
const ROW_HEIGHT = 48;
const PAGE_SIZE = 40;

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvLive,
});

function TvLive() {
  const navigate = useNavigate();
  const { channel } = Route.useSearch();
  const { activeId, playlists } = usePlaylists();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const fetchSchedules = useServerFn(getSchedules);
  const resolve = useServerFn(getPlayback);

  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const lastChannel = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  useAppSearchFocus("live-search");
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const searching = search.trim().length > 0;
  const effectiveCategory = searching ? "" : categoryId;
  const [windowStart] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);
    return now.getTime();
  });
  const guideRef = useRef<HTMLDivElement>(null);
  const windowEnd = windowStart + GUIDE_HOURS * 60 * 60_000;

  const categories = useQuery({
    queryKey: ["tv-live-categories", activeId],
    queryFn: () => {
      if (!activeId) throw new Error("No active playlist");
      return fetchCategories({ data: { playlistId: activeId, kind: "live" } });
    },
    enabled: !!activeId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const items = useQuery({
    queryKey: ["tv-live-items", activeId, effectiveCategory],
    queryFn: () => {
      if (!activeId) throw new Error("No active playlist");
      return fetchItems({
        data: { playlistId: activeId, kind: "live", ...(effectiveCategory ? { categoryId: effectiveCategory } : {}) },
      });
    },
    enabled: !!activeId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const channels = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (items.data ?? []).filter((item) => !term || item.name.toLocaleLowerCase().includes(term) || String(item.number ?? "").includes(term));
  }, [items.data, search]);
  const pageCount = Math.max(1, Math.ceil(channels.length / PAGE_SIZE));
  const visibleChannels = useMemo(
    () => channels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [channels, page],
  );
  const queryClient = useQueryClient();
  const guideStore = useQuery<GuideStore>({
    queryKey: guideKey(activeId),
    queryFn: () => queryClient.getQueryData<GuideStore>(guideKey(activeId)) ?? {},
    enabled: !!activeId,
    staleTime: Infinity,
  });
  // Only ask the provider for channels the saved guide doesn't cover yet.
  const scheduleChannels = useMemo(() => {
    const now = Date.now();
    return visibleChannels.filter((item) => {
      const saved = guideStore.data?.[item.id];
      return !saved || now - saved.at > GUIDE_TTL;
    });
  }, [visibleChannels, guideStore.data]);

  const schedules = useQuery({
    queryKey: ["tv-live-schedules", activeId, scheduleChannels.map((item) => item.id).join(","), windowStart],
    queryFn: async () => {
      if (!activeId) throw new Error("No active playlist");
      const result = await fetchSchedules({
        data: {
          playlistId: activeId,
          channelIds: scheduleChannels.map((item) => item.id),
          start: new Date(windowStart).toISOString(),
          end: new Date(windowStart + 24 * 60 * 60_000).toISOString(),
        },
      });
      mergeGuide(queryClient, activeId, result);
      return result;
    },
    enabled: !!activeId && scheduleChannels.length > 0,
    staleTime: 5 * 60_000,
  });

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Programme[]>();
    for (const [id, value] of Object.entries(guideStore.data ?? {})) map.set(id, value.p);
    for (const entry of schedules.data ?? []) map.set(entry.channelId, entry.programmes);
    return map;
  }, [schedules.data, guideStore.data]);

  useEffect(() => {
    if (!channel || channels.length === 0) return;
    const initial = channels.find((item) => item.id === channel);
    if (!initial) return;
    setPage(Math.floor(channels.indexOf(initial) / PAGE_SIZE));
    setFocusedId(initial.id);
  }, [channels, channel]);

  useEffect(() => {
    if (visibleChannels.length === 0) {
      setFocusedId(null);
      return;
    }
    if (!focusedId || !visibleChannels.some((item) => item.id === focusedId)) {
      setFocusedId(visibleChannels[0]?.id ?? null);
    }
  }, [visibleChannels, focusedId]);

  useEffect(() => {
    if (!activeId || !selected) {
      setUrl(null);
      setDirectUrl(null);
      return;
    }
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

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-focus-key="live-category-all"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-focus-key="live-player-close"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fullscreen]);

  const focusTimer = useRef<number | null>(null);
  const previewCategory = (id: string) => {
    if (focusTimer.current) window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => chooseCategory(id), 120);
  };
  const chooseCategory = (id: string) => {
    if (focusTimer.current) window.clearTimeout(focusTimer.current);
    setCategoryId(id);
    setSearch("");
    setPage(0);
    setFocusedId(null);
    guideRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const revealCell = (cell: HTMLElement, first: boolean) => {
    const guide = guideRef.current;
    if (!guide) return;
    const cellLeft = cell.offsetLeft;
    const cellRight = cellLeft + cell.offsetWidth;
    const viewLeft = guide.scrollLeft;
    const viewRight = viewLeft + guide.clientWidth - 300;
    let next = viewLeft;
    if (first) next = 0;
    else if (cellLeft < viewLeft) next = cellLeft - 16;
    else if (cellRight > viewRight) next = Math.min(cellLeft - 16, cellRight - (guide.clientWidth - 300) + 16);
    const row = cell.closest<HTMLElement>("[data-guide-row]");
    let top = guide.scrollTop;
    if (row) {
      const box = guide.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      const header = 36;
      if (rect.top < box.top + header) top += rect.top - box.top - header;
      else if (rect.bottom > box.bottom) top += rect.bottom - box.bottom;
    }
    guide.scrollTo({ left: Math.max(0, next), top });
  };

  const focusCategory = () => {
    guideRef.current?.scrollTo({ left: 0 });
    document.querySelector<HTMLElement>(`[data-focus-key="live-category-${CSS.escape(categoryId || "all")}"]`)?.focus();
  };

  const guideKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement as HTMLElement | null;
    const cell = active?.closest<HTMLElement>("[data-guide-cell]");
    if (!cell) return;
    const row = cell.closest<HTMLElement>("[data-guide-row]");
    if (!row) return;
    const cellsOf = (r: Element) => Array.from(r.querySelectorAll<HTMLElement>("[data-guide-cell]"));
    const cells = cellsOf(row);
    const idx = cells.indexOf(cell);
    const stop = () => { event.preventDefault(); event.stopPropagation(); };
    const go = (target: HTMLElement | null | undefined) => { if (target) target.focus({ preventScroll: true }); };
    if (event.key === "ArrowRight") { stop(); go(cells[idx + 1]); return; }
    if (event.key === "ArrowLeft") { stop(); if (idx <= 0) focusCategory(); else go(cells[idx - 1]); return; }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      stop();
      const rows = Array.from(guideRef.current?.querySelectorAll<HTMLElement>("[data-guide-row]") ?? []);
      const ri = rows.indexOf(row);
      const next = rows[ri + (event.key === "ArrowDown" ? 1 : -1)];
      if (!next) {
        if (event.key === "ArrowUp") go(document.querySelector<HTMLElement>('[data-focus-key="live-search"]'));
        else go(guideRef.current?.querySelector<HTMLElement>("[data-guide-next]"));
        return;
      }
      const time = Number(cell.dataset['start']);
      const targets = cellsOf(next);
      const match = idx === 0 ? targets[0] : targets.find((c) => Number(c.dataset['start']) <= time && Number(c.dataset['end']) > time) ?? targets.filter((c) => Number(c.dataset['start']) <= time).pop() ?? targets[0];
      go(match);
    }
  };

  const jumpToNow = () => {
    const id = focusedId ?? visibleChannels[0]?.id;
    guideRef.current?.scrollTo({ left: 0 });
    if (id) document.querySelector<HTMLElement>(`[data-focus-key="channel-${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };

  const restoreChannelFocus = () => {
    window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-focus-key="channel-${CSS.escape(lastChannel.current ?? "")}"]`);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "center" });
    });
  };

  const playChannel = (item: CatalogItem) => {
    setFocusedId(item.id);
    lastChannel.current = item.id;
    if (selected?.id === item.id) setFullscreen(true);
    else {
      setSelected(item);
      setFullscreen(false);
    }
  };

  const exitFullscreen = () => {
    setFullscreen(false);
    restoreChannelFocus();
  };

  const closePlayer = () => {
    setFullscreen(false);
    setSelected(null);
    setUrl(null);
    setDirectUrl(null);
    restoreChannelFocus();
  };

  const focused = channels.find((item) => item.id === focusedId) ?? null;
  const focusedProgrammes = focused ? scheduleMap.get(focused.id) ?? [] : [];
  const currentProgramme = focusedProgrammes.find((programme) => {
    const start = Date.parse(programme.start ?? "");
    const end = Date.parse(programme.end ?? "");
    return Number.isFinite(start) && Number.isFinite(end) && start <= clock && end > clock;
  });
  const markerLeft = Math.max(0, Math.min(GUIDE_WIDTH, ((clock - windowStart) / (windowEnd - windowStart)) * GUIDE_WIDTH));

  if (playlists.length === 0) {
    return (
      <TvShell title="Live TV" immersive onBack={() => void navigate({ to: "/tv" })}>
        <div className="flex h-full items-center justify-center">
          <div className="max-w-xl border-y border-border py-8 text-center">
            <Tv className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 font-display text-2xl font-bold">No playlist yet</h2>
            <p className="mt-2 text-muted-foreground">Add a playlist to load channels and programme listings.</p>
            <Button asChild className="mt-5"><Link to="/playlists" search={{ mode: "tv" }} data-tv-focus>Add playlist</Link></Button>
          </div>
        </div>
      </TvShell>
    );
  }

  return (
    <TvShell
      title="Live TV"
      immersive
      onBack={() => {
        if (fullscreen) {
          exitFullscreen();
          return;
        }
        if (selected) {
          setSelected(null);
          setUrl(null);
          setDirectUrl(null);
          window.requestAnimationFrame(focusCategory);
          return;
        }
        const activeZone = document.activeElement?.closest<HTMLElement>("[data-tv-zone]")?.dataset['tvZone'];
        if (activeZone !== "live-categories") {
          focusCategory();
          return;
        }
        void navigate({ to: "/tv" });
      }}
    >
      <div data-tv-zone-group="live-workspace" className="grid h-full min-h-0 grid-cols-[minmax(11rem,20%)_minmax(0,1fr)] gap-3 lg:gap-5">
        <aside className="flex min-h-0 flex-col border-r border-border pr-3">
          <Button variant="ghost" size="sm" className="mb-2 justify-start" onClick={() => void navigate({ to: "/tv" })}>
            <ArrowLeft className="size-4" /> TV Home
          </Button>
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">Channel categories</p>
          <div data-tv-zone="live-categories" data-tv-zone-order="1" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            <Button
              data-tv-focus
              data-focus-key="live-category-all"
              variant={categoryId === "" ? "default" : "ghost"}
              className="h-9 w-full justify-start truncate px-2 text-xs"
              onFocus={() => previewCategory("")}
              onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); document.querySelector<HTMLElement>('[data-focus-key="live-search"]')?.focus(); } }}

              onClick={() => chooseCategory("")}
            >
              All channels
            </Button>
            {(categories.data ?? []).map((category) => (
              <Button
                key={category.id}
                data-tv-focus
                data-focus-key={`live-category-${category.id}`}
                variant={categoryId === category.id ? "default" : "ghost"}
                className="h-9 w-full justify-start truncate px-2 text-xs"
                onFocus={() => previewCategory(category.id)}
                onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); document.querySelector<HTMLElement>('[data-focus-key="live-search"]')?.focus(); } }}

                onClick={() => chooseCategory(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div data-tv-zone="live-actions" data-tv-zone-order="2" data-remote-row className="mb-2 flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Search all channels" placeholder="Search all channels" value={search} data-tv-focus data-app-search="true" data-focus-key="live-search" data-zone-entry="true" className="h-9 pl-8 text-sm" onChange={(event) => { setSearch(event.target.value); setPage(0); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); guideRef.current?.querySelector<HTMLElement>('[data-focus-key^="channel-"]')?.focus(); } }} />
            </div>
            <Button data-tv-focus size="sm" variant="secondary" onClick={jumpToNow}>Now</Button>
            {selected && <Button data-tv-focus variant="secondary" size="sm" onClick={() => setFullscreen(true)}>Full screen</Button>}
            {search && <Button variant="ghost" size="icon" aria-label="Clear channel search" data-tv-focus onClick={() => { setSearch(""); setPage(0); document.querySelector<HTMLElement>('[data-focus-key="live-search" data-zone-entry="true"]')?.focus(); }}><X className="size-4" /></Button>}
          </div>
          {selected && !fullscreen && (
            <div className="mb-2 flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card p-2" aria-label={`Preview of ${selected.name}`}>
              <div className="w-64 shrink-0 overflow-hidden rounded bg-muted">
                <VideoPlayer allowNative={false} onStop={closePlayer} src={url} fallbackSrc={directUrl} title={selected.name} poster={selected.image} live className="aspect-video w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase text-primary">Preview</p>
                <p className="truncate font-display text-base font-bold">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {(scheduleMap.get(selected.id) ?? []).find((p) => Date.parse(p.start ?? "") <= clock && Date.parse(p.end ?? "") > clock)?.title ?? "Live"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Press OK again on this channel for full screen · Back to stop</p>
              </div>
            </div>
          )}

          <div className="mb-1 flex min-h-10 shrink-0 items-center justify-between gap-2 border-b border-border pb-1">
            <div className="min-w-0">
              <p className="break-words font-display text-sm font-bold">{focused?.name ?? "Live TV guide"}</p>
              <p className="truncate text-xs text-muted-foreground">{currentProgramme ? `On now · ${currentProgramme.title}` : `${channels.length} ${searching ? "matches" : "channels"} · ${formatWindow(windowStart, windowStart + 3 * 60 * 60_000)}`}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {pageCount > 1 && <span className="text-xs tabular-nums text-muted-foreground">Channels {page * PAGE_SIZE + 1}–{Math.min(channels.length, (page + 1) * PAGE_SIZE)}</span>}
              {focused && <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Play className="size-4 fill-current" /> OK to watch</p>}
            </div>
          </div>

          <div
            ref={guideRef}
            data-tv-zone="live-guide"
            data-tv-zone-order="3"
            data-horizontal-nav="true"
            onKeyDown={guideKeys}
            className="scrollbar-thin relative min-h-0 flex-1 overflow-auto overscroll-contain rounded border border-border bg-card"
            aria-label="Programme guide"
          >
            <div className="sticky top-0 z-30 flex h-9 min-w-max border-b border-border bg-background">
              <div className="sticky left-0 z-40 flex w-[300px] shrink-0 items-center border-r border-border bg-background px-2 text-xs font-semibold uppercase text-muted-foreground">Channels</div>
              <div className="grid w-[2880px] shrink-0 grid-cols-24">
                {Array.from({ length: 24 }).map((_, index) => (
                   <div key={index} className="border-r border-border px-2 py-2 text-xs font-semibold tabular-nums text-muted-foreground">
                    {timeLabel(new Date(windowStart + index * 30 * 60_000).toISOString())}
                  </div>
                ))}
              </div>
            </div>

            {items.isLoading && <p className="sticky left-0 p-6 text-muted-foreground">Loading channels…</p>}
            {!items.isLoading && channels.length === 0 && <p className="sticky left-0 p-4 text-sm text-muted-foreground">{searching ? `No channels match “${search.trim()}”.` : "No channels in this category."}</p>}
            {!items.isLoading && page > 0 && (
              <div className="flex min-w-max border-b border-border/60" style={{ height: ROW_HEIGHT }}>
                <Button variant="ghost" data-tv-focus data-zone-edge-left="true" onClick={() => setPage((value) => Math.max(0, value - 1))} className="sticky left-0 z-20 h-full w-[300px] shrink-0 justify-start rounded-none border-r border-border bg-card px-2 text-xs">
                  <ChevronLeft className="size-5" /> Previous channels
                </Button>
                <div className="flex h-full w-[2880px] shrink-0 items-center bg-muted/20 px-4 text-sm text-muted-foreground">Previous group of {PAGE_SIZE} channels</div>
              </div>
            )}
            {!items.isLoading && visibleChannels.map((item, index) => {
              const programmes = (scheduleMap.get(item.id) ?? []).filter((p) => { const st = Date.parse(p.start ?? ""); const en = Date.parse(p.end ?? ""); return Number.isFinite(st) && Number.isFinite(en) && en > windowStart && st < windowEnd; });
              return (
                <div key={item.id} data-guide-row className="flex min-w-max border-b border-border/60" style={{ height: ROW_HEIGHT }}>
                  <Button
                    variant="ghost"
                    tabIndex={-1}
                    onClick={() => playChannel(item)}
                    title={item.name}
                    aria-label={item.name}
                    className={cn(
                      "sticky left-0 z-20 h-full w-[300px] shrink-0 justify-start gap-2 whitespace-normal rounded-none border-r border-border bg-card px-2 text-left focus-visible:z-30",
                      focusedId === item.id && "bg-secondary",
                    )}
                  >
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{item.number ?? page * PAGE_SIZE + index + 1}</span>
                    {item.image && !failedImages.has(item.image) && <img src={item.image} alt="" loading="lazy" className="size-6 shrink-0 object-contain" onError={() => { const image = item.image; if (image) setFailedImages((previous) => new Set(previous).add(image)); }} />}
                    <span className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-semibold leading-4">{item.name}</span>
                  </Button>
                  <div className="relative h-full w-[2880px] shrink-0 bg-muted/20">
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-24">
                      {Array.from({ length: 24 }).map((_, marker) => <span key={marker} className="border-r border-border/60" />)}
                    </div>
                    {programmes.length === 0 ? (
                      <Button
                        variant="ghost"
                        data-tv-focus
                        data-zone-edge-left="true"
                        data-zone-entry={index === 0 ? "true" : undefined}
                        data-focus-key={`channel-${item.id}`}
                        data-guide-cell
                        data-start={windowStart}
                        data-end={windowEnd}
                        onFocus={(event) => { setFocusedId(item.id); revealCell(event.currentTarget, true); }}
                        onClick={() => playChannel(item)}
                        className="absolute inset-y-1 left-1 h-auto w-[716px] justify-start border border-border bg-secondary/60 px-2 text-xs text-muted-foreground"
                      >
                        No programme information
                      </Button>
                    ) : programmes.map((programme, programmeIndex) => (
                      <ProgrammeCell
                        key={`${programme.start}-${programmeIndex}`}
                        programme={programme}
                        windowStart={windowStart}
                        windowEnd={windowEnd}
                        first={programmeIndex === 0}
                        focusKey={programmeIndex === 0 ? `channel-${item.id}` : undefined}
                        zoneEntry={index === 0 && programmeIndex === 0}
                        onFocus={(element) => { setFocusedId(item.id); revealCell(element, programmeIndex === 0); }}
                        onSelect={() => playChannel(item)}
                      />
                    ))}
                    {clock >= windowStart && clock <= windowEnd && (
                      <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary" style={{ left: markerLeft }} aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })}
            {!items.isLoading && page < pageCount - 1 && (
              <div className="flex min-w-max" style={{ height: ROW_HEIGHT }}>
                <Button variant="ghost" data-tv-focus data-guide-next data-zone-edge-left="true" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="sticky left-0 z-20 h-full w-[300px] shrink-0 justify-start rounded-none border-r border-border bg-card px-2 text-xs">
                  <ChevronRight className="size-5" /> Next channels
                </Button>
                <div className="flex h-full w-[2880px] shrink-0 items-center bg-muted/20 px-4 text-sm text-muted-foreground">Next group of {PAGE_SIZE} channels</div>
              </div>
            )}
          </div>
        </section>
      </div>

      {selected && fullscreen && (
        <div data-tv-zone="live-player" className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6" role="dialog" aria-label={`Playing ${selected.name}`}>
          <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-bold">{selected.name}</p>
                <p className="text-sm text-muted-foreground">Live TV</p>
              </div>
              <Button data-dialog-back data-tv-focus data-focus-key="live-player-close" variant="ghost" size="icon" aria-label="Exit full screen" onClick={exitFullscreen}><X className="size-5" /></Button>
            </div>
            <VideoPlayer onStop={exitFullscreen} src={url} fallbackSrc={directUrl} title={selected.name} poster={selected.image} live className="aspect-video w-full" />
          </div>
        </div>
      )}
    </TvShell>
  );
}

function ProgrammeCell({
  programme,
  windowStart,
  windowEnd,
  first,
  focusKey,
  zoneEntry,
  onFocus,
  onSelect,
}: {
  programme: Programme;
  windowStart: number;
  windowEnd: number;
  first: boolean;
  focusKey?: string | undefined;
  zoneEntry?: boolean;
  onFocus: (element: HTMLElement) => void;
  onSelect: () => void;
}) {
  const rawStart = Date.parse(programme.start ?? "");
  const rawEnd = Date.parse(programme.end ?? "");
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
  const start = Math.max(windowStart, rawStart);
  const end = Math.min(windowEnd, rawEnd);
  if (end <= start) return null;
  const left = ((start - windowStart) / (windowEnd - windowStart)) * GUIDE_WIDTH;
  const width = Math.max(72, ((end - start) / (windowEnd - windowStart)) * GUIDE_WIDTH);

  return (
    <Button
      variant="ghost"
      data-tv-focus
      data-zone-edge-left={first ? "true" : undefined}
      data-focus-key={focusKey}
      data-zone-entry={zoneEntry ? "true" : undefined}
      data-guide-cell
      data-start={first ? windowStart : start}
      data-end={end}
      onFocus={(event) => onFocus(event.currentTarget)}
      onClick={onSelect}
      className="absolute inset-y-1 z-10 h-auto justify-start overflow-hidden rounded border border-border bg-secondary px-3 text-left focus-visible:z-20 focus-visible:bg-primary focus-visible:text-primary-foreground"
      style={{ left, width: Math.max(64, width - 4) }}
      title={programme.description ?? programme.title}
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{programme.title}</span>
        <span className="block truncate text-[10px] font-normal text-muted-foreground group-focus-visible:text-primary-foreground/80">
          {timeLabel(programme.start)} – {timeLabel(programme.end)}
        </span>
      </span>
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

function formatWindow(start: number, end: number) {
  return `${timeLabel(new Date(start).toISOString())} – ${timeLabel(new Date(end).toISOString())}`;
}
