import { useGetCategories, useGetItems, useGetSchedules, useGetPlayback } from "@/lib/device-provider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GUIDE_TTL, guideKey, mergeGuide, type GuideStore } from "@/lib/library-sync";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, Star, Tv, X } from "lucide-react";
import { z } from "zod";
import { normalizeSchedule } from "@/lib/epg-normalize";

import { getCategories, getItems, getPlayback, getSchedules } from "@/lib/iptv.functions";
import type { CatalogItem, Programme } from "@/lib/iptv-types";
import { usePlaylists } from "@/components/playlist-context";
import { TvShell } from "@/components/tv-shell";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/search-field";
import { GameSuggestionCard } from "@/components/game-suggestion";
import { SportsSchedulePanel, useSportsLeagues } from "@/components/sports-schedule";
import { SPORTS_CATEGORY_PREFIX } from "@/lib/sports-leagues";
import { VideoPlayer } from "@/components/video-player";
import { hasNativePlayer, sendRecentChannels } from "@/lib/external-player";
import { cn } from "@/lib/utils";
import { useAppSearchFocus } from "@/lib/app-search";
import { compareTitles, isFavorite, useFavorites, useToggleFavorite } from "@/lib/library-hooks";
import { useLongPress } from "@/lib/use-long-press";
import { MultiView } from "@/components/multi-view";
import { ChannelActionMenu, type ProgrammeInfo } from "@/components/channel-action-menu";
import { FAVOURITES_CATEGORY, RECENT_CATEGORY, orderByRecent, useRecentChannels, useTouchRecent } from "@/lib/recent-channels";
import { toast } from "sonner";
import { debugLog, describeElement, trace } from "@/lib/debug-log";

const GUIDE_HOURS = 12;
const GUIDE_WIDTH = 2880;
const ROW_HEIGHT = 48;
const PAGE_SIZE = 40;

export const Route = createFileRoute("/_authenticated/tv/live")({
  validateSearch: z.object({ channel: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Live TV on your TV — Jolzplay" },
      {
        name: "description",
        content: "Browse channels with your remote and watch live TV full screen.",
      },
      { property: "og:title", content: "Live TV on your TV — Jolzplay" },
      { property: "og:description", content: "Remote-friendly channel list and player." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvLive,
});

/** Right from a category: land on the guide row nearest the same height (its current programme). */
function enterGuideNear(from: HTMLElement) {
  const guide = document.querySelector<HTMLElement>('[data-tv-zone="live-guide"]');
  const y = from.getBoundingClientRect().top + from.offsetHeight / 2;
  const box = guide?.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const row of Array.from(guide?.querySelectorAll<HTMLElement>("[data-guide-row]") ?? [])) {
    const rect = row.getBoundingClientRect();
    if (box && (rect.bottom <= box.top + 36 || rect.top >= box.bottom)) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - y);
    if (distance < bestDistance) { bestDistance = distance; best = row; }
  }
  const cell = best?.querySelector<HTMLElement>("[data-guide-cell]") ?? guide?.querySelector<HTMLElement>("[data-guide-cell]");
  if (cell) cell.focus({ preventScroll: true });
  else document.querySelector<HTMLElement>('[data-focus-key="live-search"]')?.focus();
}

function ChannelNameButton({
  label,
  starred,
  onPlay,
  onToggleFavorite,
  className,
  children,
}: {
  label: string;
  starred: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const longPress = useLongPress(onToggleFavorite);
  return (
    <Button
      variant="ghost"
      tabIndex={-1}
      onClick={onPlay}
      title={`${label} — hold OK or right-click for favourites and recording`}
      aria-label={label}
      {...longPress}
      onContextMenu={(event) => { event.preventDefault(); onToggleFavorite(); }}
      className={className}
    >
      {children}
      {starred && <Star className="size-3 shrink-0 fill-primary text-primary" />}
    </Button>
  );
}

function EmptyGuideButton({ onLongPress, ...props }: React.ComponentProps<typeof Button> & { onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress);
  return <Button {...props} {...longPress} onContextMenu={(event) => { event.preventDefault(); onLongPress(); }} />;
}

/** A channel category in the rail: quick press opens it, hold OK stars it. */
function LiveCategoryButton({
  category,
  starred,
  active,
  onOpen,
  onToggleFavorite,
  onPreview,
}: {
  category: { id: string; name: string };
  starred: boolean;
  active: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onPreview: () => void;
}) {
  const longPress = useLongPress(onToggleFavorite);
  return (
    <Button
      data-tv-focus
      data-focus-key={`live-category-${category.id}`}
      variant={active ? "default" : "ghost"}
      className="h-9 w-full justify-start truncate px-2 text-xs"
      title={`${category.name} — hold OK to ${starred ? "remove from" : "add to"} favourite categories`}
      onFocus={onPreview}
      onClick={onOpen}
      {...longPress}
      onKeyDown={(event) => {
        longPress.onKeyDown(event);
        if (event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          enterGuideNear(event.currentTarget);
        }
      }}
    >
      {starred && <Star className="size-3 shrink-0 fill-primary text-primary" />}
      {category.name}
    </Button>
  );
}

function TvLive() {
  const navigate = useNavigate();
  const EVENT_CATEGORY = /\b(nhl|nba|nfl|mlb|mls|ufc|sports?|events?|ppv)\b/i;
  const { channel } = Route.useSearch();
  const { activeId, playlists } = usePlaylists();
  const fetchCategories = useGetCategories();
  const fetchItems = useGetItems();
  const fetchSchedules = useGetSchedules();
  const resolve = useGetPlayback();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [menuItem, setMenuItem] = useState<CatalogItem | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const lastChannel = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  // Which channel the resolved link belongs to, so a previous channel's link
  // is never handed to the player while the new one is still resolving.
  const [urlFor, setUrlFor] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  useAppSearchFocus("live-search");
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const searching = search.trim().length > 0;
  const sportsLeague = !searching && categoryId.startsWith(SPORTS_CATEGORY_PREFIX) ? categoryId.slice(SPORTS_CATEGORY_PREFIX.length) : null;
  const sportsLeagues = useSportsLeagues();
  const effectiveCategory = searching || sportsLeague || categoryId === RECENT_CATEGORY || categoryId === FAVOURITES_CATEGORY ? "" : categoryId;
  const recent = useRecentChannels(activeId);
  const touchRecent = useTouchRecent();
  const [multiOpen, setMultiOpen] = useState(false);
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
    // The full list (Favourites, Recent, search) is huge; the library sync keeps
    // it fresh in the background, so opening Live TV never re-downloads it.
    staleTime: effectiveCategory === ""
      ? Infinity
      : EVENT_CATEGORY.test(categories.data?.find((c) => c.id === effectiveCategory)?.name ?? "") ? 5 * 60_000 : 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const channels = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term && categoryId === FAVOURITES_CATEGORY) {
      const ids = new Set((favorites.data ?? []).filter((row) => row.playlistId === activeId && row.itemKind === "live").map((row) => row.itemId));
      // Favourite channels read A–Z so the remote finds a name predictably.
      return (items.data ?? []).filter((item) => ids.has(item.id)).sort((a, b) => compareTitles(a.name, b.name));
    }
    const source = !term && categoryId === RECENT_CATEGORY ? orderByRecent(items.data ?? [], recent.rows) : (items.data ?? []);
    return source.filter((item) => !term || item.name.toLocaleLowerCase().includes(term) || String(item.number ?? "").includes(term));
  }, [items.data, search, categoryId, recent.rows, favorites.data, activeId]);
  const visibleChannels = useMemo(
    () => channels.slice(0, limit),
    [channels, limit],
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
    for (const [id, value] of Object.entries(guideStore.data ?? {})) map.set(id, normalizeSchedule(value.p));
    for (const entry of schedules.data ?? []) map.set(entry.channelId, normalizeSchedule(entry.programmes));
    return map;
  }, [schedules.data, guideStore.data]);

  useEffect(() => {
    if (!channel || channels.length === 0) return;
    const initial = channels.find((item) => item.id === channel);
    if (!initial) return;
    setLimit((value) => Math.max(value, channels.indexOf(initial) + PAGE_SIZE));
    // Opened from favourites: start the channel straight away instead of
    // only focusing its row, then drop the parameter so Back or a refresh
    // doesn't restart playback.
    playChannel(initial);
    void navigate({ to: ".", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setUrlFor(selected.id);
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

  // The guide opens with focus on Favourites so the remote lands on the
  // user's own channels first; accounts without favourite channels still
  // open on All channels.
  const openedOnFavourites = useRef(false);
  useEffect(() => {
    if (openedOnFavourites.current || favorites.isLoading || !activeId) return;
    openedOnFavourites.current = true;
    const hasFavouriteChannels = (favorites.data ?? []).some(
      (row) => row.playlistId === activeId && row.itemKind === "live",
    );
    const focusKey = hasFavouriteChannels ? `live-category-${FAVOURITES_CATEGORY}` : "live-category-all";
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [favorites.isLoading, favorites.data, activeId]);

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
    setLimit(PAGE_SIZE);
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
      const targets = cellsOf(next);
      const x = idx === 0 ? -1 : cell.offsetLeft + cell.offsetWidth / 2;
      const match = idx === 0 ? targets[0] : targets.find((c) => c.offsetLeft <= x && c.offsetLeft + c.offsetWidth > x)
        ?? targets.reduce<HTMLElement | undefined>((bestCell, c) => !bestCell || Math.abs(c.offsetLeft + c.offsetWidth / 2 - x) < Math.abs(bestCell.offsetLeft + bestCell.offsetWidth / 2 - x) ? c : bestCell, undefined);
      go(match);
    }
  };

  const jumpToNow = () => {
    const id = focusedId ?? visibleChannels[0]?.id;
    guideRef.current?.scrollTo({ left: 0 });
    if (id) document.querySelector<HTMLElement>(`[data-focus-key="channel-${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };

  // Index of the channel row when the menu opened — used when that row disappears (e.g. unfavourited inside Favourites).
  const lastChannelIndex = useRef(0);
  const channelRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-focus-key^="channel-"]'));
  const openMenu = (item: CatalogItem) => {
    lastChannelIndex.current = Math.max(0, channelRows().findIndex((row) => row.dataset["focusKey"] === `channel-${item.id}`));
    setMenuItem(item);
  };
  // Sports cards (league "today" lists, "Game on") return focus to the exact card that started playback.
  const lastSportCard = useRef<string | null>(null);
  const restoreChannelFocus = () => {
    const attempt = (tries: number) => window.requestAnimationFrame(() => {
      const sportKey = lastSportCard.current;
      let row = sportKey ? document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(sportKey)}"]`) : null;
      if (!row && sportKey && tries > 0) { attempt(tries - 1); return; }
      row ??= document.querySelector<HTMLElement>(`[data-focus-key="channel-${CSS.escape(lastChannel.current ?? "")}"]`);
      if (!row) {
        const rows = channelRows();
        row = rows[Math.min(lastChannelIndex.current, rows.length - 1)] ?? null;
      }
      if (!row && tries > 0) { attempt(tries - 1); return; }
      row ??= document.querySelector<HTMLElement>('[data-focus-key^="category-"], [data-tv-focus]');
      trace("Guide: restoring selection", { tries, found: !!row });
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "center" });
      trace("Guide: selection restored", describeElement(document.activeElement));
      debugLog("guide", "Selection restored", { target: describeElement(row), active: describeElement(document.activeElement), dialogs: document.querySelectorAll('[role="dialog"]').length });
    });
    attempt(lastSportCard.current ? 20 : 3);
  };

  const toggleCategoryFavorite = (category: { id: string; name: string }) => {
    if (!activeId) return;
    const starred = isFavorite(favorites.data, activeId, "live_category", category.id);
    toggleFavorite.mutate(
      { playlistId: activeId, itemKind: "live_category", itemId: category.id, title: category.name, logoUrl: null },
      { onSuccess: () => toast.success(starred ? `Removed ${category.name} from favourite categories` : `Added ${category.name} to favourite categories`) },
    );
  };

  // Favourite categories pin to the top of the rail, A–Z; the rest follow.
  const favouriteCategoryIds = useMemo(
    () => new Set((favorites.data ?? []).filter((row) => row.playlistId === activeId && row.itemKind === "live_category").map((row) => row.itemId)),
    [favorites.data, activeId],
  );
  const favouriteCategories = useMemo(
    () => (categories.data ?? []).filter((category) => favouriteCategoryIds.has(category.id)).sort((a, b) => compareTitles(a.name, b.name)),
    [categories.data, favouriteCategoryIds],
  );
  const otherCategories = useMemo(
    () => (categories.data ?? []).filter((category) => !favouriteCategoryIds.has(category.id)),
    [categories.data, favouriteCategoryIds],
  );

  const toggleChannelFavorite = (item: CatalogItem) => {
    if (!activeId) return;
    const starred = isFavorite(favorites.data, activeId, "live", item.id);
    toggleFavorite.mutate(
      { playlistId: activeId, itemKind: "live", itemId: item.id, title: item.name, logoUrl: item.image },
      { onSuccess: () => toast.success(starred ? `Removed ${item.name} from favourites` : `Added ${item.name} to favourites`) },
    );
  };

  const playChannel = (item: CatalogItem) => {
    debugLog("guide", "Starting channel full screen", { channel: item.id });
    trace("Guide: starting channel", { channel: item.id });
    setFocusedId(item.id);
    lastChannel.current = item.id;
    lastSportCard.current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-sport-card]")?.dataset["focusKey"] ?? null;
    touchRecent(activeId, item);
    // Pressing a channel starts it full screen right away — no in-page preview.
    setSelected(item);
    setFullscreen(true);
  };

  const refreshPlayback = async () => {
    if (!activeId || !selected) return;
    const result = await resolve({ data: { playlistId: activeId, kind: "live", itemId: selected.id } });
    setUrlFor(selected.id);
    setUrl(result.url);
    setDirectUrl(result.directUrl);
  };

  const [updatingChannels, setUpdatingChannels] = useState(false);
  const updateChannels = async () => {
    if (!activeId || updatingChannels) return;
    setUpdatingChannels(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["tv-live-categories", activeId] });
      const fresh = await queryClient.fetchQuery({
        queryKey: ["tv-live-items", activeId, effectiveCategory],
        queryFn: () => fetchItems({ data: { playlistId: activeId, kind: "live", ...(effectiveCategory ? { categoryId: effectiveCategory } : {}) } }),
        staleTime: 0,
      });
      if (selected) {
        const name = selected.name.trim().toLocaleLowerCase();
        const match = fresh.find((item) => item.id === selected.id) ?? fresh.find((item) => item.name.trim().toLocaleLowerCase() === name);
        if (match) {
          setSelected(match);
          if (match.id === selected.id) await refreshPlayback().catch(() => undefined);
        }
      }
      toast.success("Channels updated");
    } catch (error) {
      toast.error(`Couldn't update channels: ${(error as Error).message}`);
    } finally {
      setUpdatingChannels(false);
    }
  };

  const exitFullscreen = () => {
    debugLog("guide", "Leaving full screen", { channel: lastChannel.current });
    trace("Guide: leaving full screen");
    setFullscreen(false);
    restoreChannelFocus();
    trace("Guide: full screen closed, restoring selection");
  };


  // Resolve the recent channels' links while a channel plays full screen:
  // the native player's bottom bar (Down on the remote, TiviMate-style) and
  // the web player's recents strip both use this list.
  const [recentList, setRecentList] = useState<{ itemId: string; title: string; url: string }[]>([]);
  // Only re-prepare the player's recent channels when the list's order really changes.
  const recentKey = recent.rows.map((row) => row.itemId).join(",");
  useEffect(() => {
    if (!fullscreen || !activeId || !selected) {
      setRecentList([]);
      return;
    }
    let cancelled = false;
    // Order straight from the Recent rows so channels from other categories
    // keep their true position instead of dropping out of the list.
    const candidates = recent.rows.filter((row) => row.itemId !== selected.id).slice(0, 9);
    trace("Guide: preparing recent channels for player", { count: candidates.length });
    void (async () => {
      const list: { itemId: string; title: string; url: string }[] = [];
      for (const row of candidates) {
        try {
          const result = await resolve({ data: { playlistId: activeId, kind: "live", itemId: row.itemId } });
          list.push({ itemId: row.itemId, title: row.title, url: result.directUrl ?? result.url });
        } catch {
          // Skip channels whose link couldn't be resolved.
        }
        if (cancelled) return;
      }
      setRecentList(list);
      if (hasNativePlayer()) sendRecentChannels(list);
      trace("Guide: recent channels sent to player", { count: list.length });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, selected?.id, activeId, recentKey]);

  const pickRecent = (title: string) => {
    const entry = recentList.find((recentItem) => recentItem.title === title);
    const item =
      (entry && (items.data ?? []).find((channel) => channel.id === entry.itemId)) ??
      (entry ? { id: entry.itemId, name: entry.title, image: null, categoryId: null } : (items.data ?? []).find((channel) => channel.name === title));
    if (item) playChannel(item);
  };

  // The native bottom bar switched channel: keep the page and Recent in sync.
  useEffect(() => {
    window.__streamDeckChannelSwitched = (title) => {
      // Match by the id we handed the player, so same-name channels can't swap places.
      const entry = recentList.find((recentItem) => recentItem.title === title);
      const item =
        (entry && (items.data ?? []).find((channel) => channel.id === entry.itemId)) ??
        (entry ? { id: entry.itemId, name: entry.title, image: null, categoryId: null } : (items.data ?? []).find((channel) => channel.name === title));
      if (!item) return;
      lastChannel.current = item.id;
      setSelected(item);
      touchRecent(activeId, item);
    };
    return () => {
      window.__streamDeckChannelSwitched = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data, activeId, recentList]);

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
              data-focus-key={`live-category-${FAVOURITES_CATEGORY}`}
              variant={categoryId === FAVOURITES_CATEGORY ? "default" : "ghost"}
              className="h-9 w-full justify-start truncate px-2 text-xs"
              onFocus={() => previewCategory(FAVOURITES_CATEGORY)}
              onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); enterGuideNear(event.currentTarget); } }}
              onClick={() => chooseCategory(FAVOURITES_CATEGORY)}
            >
              <Star className="size-3 shrink-0" /> Favourites
            </Button>
            {recent.rows.length > 0 && (
              <Button
                data-tv-focus
                data-focus-key={`live-category-${RECENT_CATEGORY}`}
                variant={categoryId === RECENT_CATEGORY ? "default" : "ghost"}
                className="h-9 w-full justify-start truncate px-2 text-xs"
                onFocus={() => previewCategory(RECENT_CATEGORY)}
                onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); enterGuideNear(event.currentTarget); } }}
                onClick={() => chooseCategory(RECENT_CATEGORY)}
              >
                Recent
              </Button>
            )}
            {sportsLeagues.map((league) => (
              <Button
                key={league.key}
                data-tv-focus
                data-focus-key={`live-category-${SPORTS_CATEGORY_PREFIX}${league.key}`}
                variant={categoryId === SPORTS_CATEGORY_PREFIX + league.key ? "default" : "ghost"}
                className="h-9 w-full justify-start truncate px-2 text-xs"
                onFocus={() => previewCategory(SPORTS_CATEGORY_PREFIX + league.key)}
                onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); (document.querySelector<HTMLElement>('[data-focus-key="sports-first-card"]') ?? document.querySelector<HTMLElement>('[data-focus-key="live-search"]'))?.focus(); } }}
                onClick={() => chooseCategory(SPORTS_CATEGORY_PREFIX + league.key)}
              >
                {league.label} today <span className="opacity-70">(beta)</span>
              </Button>
            ))}
            {favouriteCategories.map((category) => (
              <LiveCategoryButton
                key={category.id}
                category={category}
                starred
                active={categoryId === category.id}
                onOpen={() => chooseCategory(category.id)}
                onToggleFavorite={() => toggleCategoryFavorite(category)}
                onPreview={() => previewCategory(category.id)}
              />
            ))}
            <Button
              data-tv-focus
              data-focus-key="live-category-all"
              variant={categoryId === "" ? "default" : "ghost"}
              className="h-9 w-full justify-start truncate px-2 text-xs"
              onFocus={() => previewCategory("")}
              onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); enterGuideNear(event.currentTarget); } }}

              onClick={() => chooseCategory("")}
            >
              All channels
            </Button>
            {otherCategories.map((category) => (
              <LiveCategoryButton
                key={category.id}
                category={category}
                starred={false}
                active={categoryId === category.id}
                onOpen={() => chooseCategory(category.id)}
                onToggleFavorite={() => toggleCategoryFavorite(category)}
                onPreview={() => previewCategory(category.id)}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div data-tv-zone="live-actions" data-tv-zone-order="2" data-remote-row className="mb-2 flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchField aria-label="Search all channels" placeholder="Search all channels" value={search} data-tv-focus data-app-search="true" data-focus-key="live-search" data-zone-entry="true" className="h-9 text-sm" onValueChange={(value) => { setSearch(value); setLimit(PAGE_SIZE); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); (document.querySelector<HTMLElement>('[data-focus-key="sports-first-card"]') ?? guideRef.current?.querySelector<HTMLElement>('[data-focus-key^="channel-"]'))?.focus(); } }} />
            </div>
            <Button data-tv-focus size="sm" variant="secondary" onClick={jumpToNow}>Now</Button>
            <Button data-tv-focus variant="secondary" size="sm" disabled={updatingChannels} onClick={() => void updateChannels()}>{updatingChannels ? "Updating…" : "Update channels"}</Button>
            <Button data-tv-focus variant="secondary" size="sm" onClick={() => setMultiOpen(true)}>Multi-view</Button>
          </div>
          {searching && <GameSuggestionCard query={search} channels={items.data} onPlay={playChannel} />}
          <div className="mb-1 flex min-h-10 shrink-0 items-center justify-between gap-2 border-b border-border pb-1">
            <div className="min-w-0">
              <p className="break-words font-display text-sm font-bold">{focused?.name ?? "Live TV guide"}</p>
              <p className="truncate text-xs text-muted-foreground">{currentProgramme ? `On now · ${currentProgramme.title}` : `${channels.length} ${searching ? "matches" : "channels"} · ${formatWindow(windowStart, windowStart + 3 * 60 * 60_000)}`}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {channels.length > PAGE_SIZE && <span className="text-xs tabular-nums text-muted-foreground">Showing {Math.min(limit, channels.length)} of {channels.length} channels</span>}
            </div>
          </div>

          {sportsLeague && <SportsSchedulePanel leagueKey={sportsLeague} channels={items.data} onPlay={playChannel} onExitLeft={focusCategory} onExitUp={() => document.querySelector<HTMLElement>('[data-focus-key="live-search"]')?.focus()} />}
          <div
            ref={guideRef}
            hidden={!!sportsLeague}
            data-tv-zone={sportsLeague ? undefined : "live-guide"}
            data-tv-zone-order="3"
            data-horizontal-nav="true"
            onKeyDown={guideKeys}
            className="scrollbar-thin relative min-h-0 flex-1 overflow-auto overscroll-contain rounded border border-border bg-card"
            aria-label="Programme guide"
          >
            <div data-tv-guide-header className="sticky top-0 z-30 flex h-9 min-w-max border-b border-border bg-background">
              <div className="sticky left-0 z-40 flex w-[300px] shrink-0 items-center border-r border-border bg-background px-2 text-xs font-semibold uppercase text-muted-foreground">Channels</div>
              <div className="grid w-[2880px] shrink-0 grid-cols-24">
                {Array.from({ length: 24 }).map((_, index) => (
                   <div key={index} className="border-r border-border px-2 py-2 text-xs font-semibold tabular-nums text-muted-foreground">
                    {timeLabel(new Date(windowStart + index * 30 * 60_000).toISOString())}
                  </div>
                ))}
              </div>
            </div>

            {(items.isLoading || (categoryId === FAVOURITES_CATEGORY && favorites.isLoading)) && <p className="sticky left-0 p-6 text-muted-foreground">Loading channels…</p>}
            {!items.isLoading && !(categoryId === FAVOURITES_CATEGORY && favorites.isLoading) && channels.length === 0 && <p className="sticky left-0 p-4 text-sm text-muted-foreground">{searching ? `No channels match “${search.trim()}”.` : categoryId === FAVOURITES_CATEGORY ? "No favourite channels in this playlist yet." : "No channels in this category."}</p>}
            {!items.isLoading && visibleChannels.map((item, index) => {
              const programmes = (scheduleMap.get(item.id) ?? []).filter((p) => { const st = Date.parse(p.start ?? ""); const en = Date.parse(p.end ?? ""); return Number.isFinite(st) && Number.isFinite(en) && en > windowStart && st < windowEnd; });
              return (
                <div key={item.id} data-guide-row className="flex min-w-max border-b border-border/60" style={{ height: ROW_HEIGHT }}
                  onFocusCapture={() => { if (index >= limit - 10 && limit < channels.length) setLimit((value) => Math.min(channels.length, value + PAGE_SIZE)); }}
                >
                  <ChannelNameButton
                    label={item.name}
                    starred={isFavorite(favorites.data, activeId, "live", item.id)}
                    onPlay={() => playChannel(item)}
                    onToggleFavorite={() => setMenuItem(item)}
                    className={cn(
                      "sticky left-0 z-20 h-full w-[300px] shrink-0 justify-start gap-2 whitespace-normal rounded-none border-r border-border bg-card px-2 text-left focus-visible:z-30",
                      focusedId === item.id && "bg-secondary",
                    )}
                  >
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{item.number ?? index + 1}</span>
                    {item.image && !failedImages.has(item.image) && <img src={item.image} alt="" loading="lazy" className="size-6 shrink-0 object-contain" onError={() => { const image = item.image; if (image) setFailedImages((previous) => new Set(previous).add(image)); }} />}
                    <span className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-semibold leading-4">{item.name}</span>
                  </ChannelNameButton>
                  <div className="relative h-full w-[2880px] shrink-0 bg-muted/20">
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-24">
                      {Array.from({ length: 24 }).map((_, marker) => <span key={marker} className="border-r border-border/60" />)}
                    </div>
                    {programmes.length === 0 ? (
                      <EmptyGuideButton onLongPress={() => setMenuItem(item)}
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
                      </EmptyGuideButton>
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
                        onLongPress={() => setMenuItem(item)}
                      />
                    ))}
                    {clock >= windowStart && clock <= windowEnd && (
                      <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary" style={{ left: markerLeft }} aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })}
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
            <VideoPlayer onStop={exitFullscreen} onRefreshSource={refreshPlayback} recents={recentList.map(({ title, url }) => ({ title, url }))} onPickRecent={pickRecent} src={urlFor === selected.id ? url : null} fallbackSrc={urlFor === selected.id ? directUrl : null} title={selected.name} poster={selected.image} live className="aspect-video w-full" />
          </div>
        </div>
      )}
      <ChannelActionMenu
        tv
        channel={menuItem}
        starred={!!menuItem && isFavorite(favorites.data, activeId, "live", menuItem.id)}
        onToggleFavorite={() => { if (menuItem) toggleChannelFavorite(menuItem); }}
        onClose={() => { if (menuItem) lastChannel.current = menuItem.id; setMenuItem(null); restoreChannelFocus(); }}
        programmeAt={(time): ProgrammeInfo | null => {
          if (!menuItem) return null;
          const hit = (scheduleMap.get(menuItem.id) ?? []).find((p) => Date.parse(p.start ?? "") <= time && Date.parse(p.end ?? "") > time);
          return hit ? { title: hit.title, end: Date.parse(hit.end ?? "") } : null;
        }}
        getStreamUrl={async () => {
          if (!activeId || !menuItem) return null;
          const result = await resolve({ data: { playlistId: activeId, kind: "live", itemId: menuItem.id } });
          return result.directUrl ?? result.url;
        }}
      />
      <MultiView
        open={multiOpen}
        playlistId={activeId}
        initial={selected ?? focused}
        candidates={[
          ...orderByRecent(items.data ?? [], recent.rows),
          ...(items.data ?? []).filter((item) => isFavorite(favorites.data, activeId, "live", item.id)),
          ...visibleChannels,
        ]}
        onClose={() => { setMultiOpen(false); restoreChannelFocus(); }}
      />
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
  onLongPress,
}: {
  programme: Programme;
  windowStart: number;
  windowEnd: number;
  first: boolean;
  focusKey?: string | undefined;
  zoneEntry?: boolean;
  onFocus: (element: HTMLElement) => void;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);
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
      {...longPress}
      onContextMenu={(event) => { event.preventDefault(); onLongPress(); }}
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
