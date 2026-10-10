import { clearPlaylistEntries, isTruncatedCatalogue } from "@/lib/device-cache";
import { toast } from "sonner";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCategories, getItems, getSchedules } from "@/lib/iptv.functions";
import { backfillTitles, getCachedTitleMetadata } from "@/lib/metadata.functions";
import type { CatalogItem, Programme } from "@/lib/iptv-types";
import type { TitleMetadata } from "@/lib/metadata.server";

export const GUIDE_TTL = 4 * 60 * 60_000;
const LIBRARY_TTL = 12 * 60 * 60_000;
const GUIDE_SPAN = 24 * 60 * 60_000;
const GUIDE_BATCH = 40;
const GUIDE_MAX_CHANNELS = 1500;

/** Saved guide: channelId -> programmes + when they were fetched. */
export type GuideStore = Record<string, { p: Programme[]; at: number }>;
export const guideKey = (playlistId: string | null) => ["device-guide", playlistId] as const;

export function mergeGuide(client: QueryClient, playlistId: string, entries: { channelId: string; programmes: Programme[] }[]) {
  const now = Date.now();
  client.setQueryData<GuideStore>(guideKey(playlistId), (old) => {
    const next: GuideStore = {};
    // Drop finished programmes so the saved guide stays small.
    for (const [id, value] of Object.entries(old ?? {})) {
      next[id] = { at: value.at, p: value.p.filter((programme) => Date.parse(programme.end ?? "") > now) };
    }
    for (const entry of entries) next[entry.channelId] = { p: entry.programmes, at: now };
    return next;
  });
}

export interface SyncStatus { running: boolean; done: number; total: number }

export interface LibrarySectionStatus {
  total: number;
  updated: number;
  percent: number;
  /** Titles with a real description / channels with programme descriptions. */
  withOverview: number;
  /** Titles with known actors. */
  withCast: number;
  topGenres: string[];
  updatedAt: number;
  loaded: boolean;
}

export interface LibraryOverview {
  live: LibrarySectionStatus;
  movie: LibrarySectionStatus;
  series: LibrarySectionStatus;
}

const emptySection = (): LibrarySectionStatus => ({
  total: 0,
  updated: 0,
  percent: 0,
  withOverview: 0,
  withCast: 0,
  topGenres: [],
  updatedAt: 0,
  loaded: false,
});

/** Live summary of the active playlist's saved, on-device library. */
export function useLibraryOverview(playlistId: string | null): LibraryOverview {
  const client = useQueryClient();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      const [family, owner] = event.query.queryKey;
      if (owner !== playlistId || !["system-catalogue", "cached-title-metadata", "tv-live-items", "device-guide"].includes(String(family))) return;
      if (event.type !== "updated" || event.action.type !== "success" || timer) return;
      timer = setTimeout(() => { timer = undefined; setRevision((value) => value + 1); }, 500);
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, [client, playlistId]);

  return useMemo(() => {
    if (!playlistId) return { live: emptySection(), movie: emptySection(), series: emptySection() };
    const section = (kind: "movie" | "series"): LibrarySectionStatus => {
      const key = ["system-catalogue", playlistId, kind] as const;
      const items = client.getQueryData<CatalogItem[]>(key);
      const names = new Set((items ?? []).map((item) => item.name));
      const metadata: Record<string, TitleMetadata> = {};
      let metadataUpdatedAt = 0;
      for (const [queryKey, data] of client.getQueriesData<Record<string, TitleMetadata>>({ queryKey: ["cached-title-metadata", playlistId, kind] })) {
        Object.assign(metadata, data ?? {});
        metadataUpdatedAt = Math.max(metadataUpdatedAt, client.getQueryState(queryKey)?.dataUpdatedAt ?? 0);
      }
      const enriched = [...names].filter((name) => metadata[name]);
      const genres = new Map<string, number>();
      for (const name of enriched) {
        for (const genre of new Set(metadata[name]?.genres ?? [])) genres.set(genre, (genres.get(genre) ?? 0) + 1);
      }
      const total = items?.length ?? 0;
      return {
        total,
        updated: enriched.length,
        percent: total ? Math.round((enriched.length / total) * 100) : 0,
        withOverview: enriched.filter((name) => metadata[name]?.overview).length,
        withCast: enriched.filter((name) => metadata[name]?.cast?.length).length,
        topGenres: [...genres].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([genre]) => genre),
        updatedAt: Math.max(client.getQueryState(key)?.dataUpdatedAt ?? 0, metadataUpdatedAt),
        loaded: items !== undefined,
      };
    };
    const liveKey = ["tv-live-items", playlistId, ""] as const;
    const channels = client.getQueryData<CatalogItem[]>(liveKey);
    const guide = client.getQueryData<GuideStore>(guideKey(playlistId));
    const covered = channels ? channels.filter((channel) => guide?.[channel.id]).length : 0;
    const total = channels?.length ?? 0;
    const guideUpdatedAt = Object.values(guide ?? {}).reduce((latest, value) => Math.max(latest, value.at), 0);
    return {
      live: {
        total,
        updated: covered,
        percent: total ? Math.round((covered / total) * 100) : 0,
        withOverview: channels ? channels.filter((channel) => guide?.[channel.id]?.p.some((programme) => programme.description)).length : 0,
        withCast: 0,
        topGenres: [],
        updatedAt: Math.max(client.getQueryState(liveKey)?.dataUpdatedAt ?? 0, guideUpdatedAt),
        loaded: channels !== undefined,
      },
      movie: section("movie"),
      series: section("series"),
    };
  }, [client, playlistId, revision]);
}

/* -------- user-requested full refresh (Settings → Update library & guide) */
export interface RefreshStatus { running: boolean; phase: string; done: number; total: number }
let refreshState: RefreshStatus = { running: false, phase: "", done: 0, total: 0 };
let refreshRequest: { playlistId: string; n: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function setRefresh(next: RefreshStatus) { refreshState = next; emit(); }
export function requestLibraryRefresh(playlistId: string) {
  if (refreshState.running) return;
  refreshRequest = { playlistId, n: (refreshRequest?.n ?? 0) + 1 };
  setRefresh({ running: true, phase: "Starting", done: 0, total: 0 });
}
export function useLibraryRefreshStatus() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => refreshState,
    () => refreshState,
  );
}
function useRefreshRequest() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => refreshRequest,
    () => null,
  );
}

/**
 * Background library sync: refreshes categories, channels, movies, shows and
 * the TV guide for the active playlist, only when the saved copy is stale.
 */
export function useLibrarySync(playlistId: string | null): SyncStatus {
  const client = useQueryClient();
  const fetchCategories = useServerFn(getCategories);
  const fetchItems = useServerFn(getItems);
  const fetchSchedules = useServerFn(getSchedules);
  const [status, setStatus] = useState<SyncStatus>({ running: false, done: 0, total: 0 });
  const request = useRefreshRequest();
  const force = !!request && request.playlistId === playlistId;

  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    const phase = (name: string, done = 0, total = 0) => { if (force) setRefresh({ running: true, phase: name, done, total }); };
    const stale = (key: readonly unknown[], ttl: number) => {
      const state = client.getQueryState(key);
      return !state?.dataUpdatedAt || Date.now() - state.dataUpdatedAt > ttl || isTruncatedCatalogue(key, state.data);
    };
    const refresh = async <T,>(key: readonly unknown[], fn: () => Promise<T>) => {
      if (!force && !stale(key, LIBRARY_TTL)) return client.getQueryData<T>(key);
      const old = client.getQueryData<T>(key);
      try {
        const data = await fn();
        // Keep the saved copy if the provider returns nothing (outage/hiccup).
        if (!force && Array.isArray(old) && old.length > 0 && Array.isArray(data) && data.length === 0) return old;
        // Structural sharing keeps unchanged entries; only differences are applied.
        client.setQueryData(key, data);
        return client.getQueryData<T>(key);
      } catch {
        return old;
      }
    };

    const run = async () => {
      if (force) {
        phase("Clearing saved copy");
        await clearPlaylistEntries(playlistId);
        for (const key of ["tv-live-categories", "tv-live-items", "system-catalogue", "device-guide", "global-search-live", "global-search"]) {
          client.removeQueries({ predicate: (q) => q.queryKey[0] === key && q.queryKey.includes(playlistId) });
        }
        phase("Channels");
      }
      const first = client.getQueryData(["tv-live-items", playlistId, ""]) === undefined;
      if (first) setStatus({ running: true, done: 0, total: 0 });
      await refresh(["tv-live-categories", playlistId], () => fetchCategories({ data: { playlistId, kind: "live" } }));
      const channels = await refresh<CatalogItem[]>(["tv-live-items", playlistId, ""], () => fetchItems({ data: { playlistId, kind: "live" } }));
      if (channels) client.setQueryData(["global-search-live", playlistId, "live"], channels);
      if (cancelled) return;
      phase("Movies");
      await refresh(["system-catalogue", playlistId, "movie"], () => fetchItems({ data: { playlistId, kind: "movie" } }));
      phase("Shows");
      await refresh(["system-catalogue", playlistId, "series"], () => fetchItems({ data: { playlistId, kind: "series" } }));
      const finish = () => {
        setStatus({ running: false, done: 0, total: 0 });
        if (force && !cancelled) {
          setRefresh({ running: false, phase: "", done: 0, total: 0 });
          refreshRequest = null; emit();
          toast.success("Library updated");
        }
      };
      if (cancelled || !channels?.length) { finish(); return; }

      // Guide: only channels missing from the saved copy or older than the TTL.
      const store = client.getQueryData<GuideStore>(guideKey(playlistId)) ?? {};
      const now = Date.now();
      const due = channels.slice(0, GUIDE_MAX_CHANNELS).map((c) => c.id).filter((id) => !store[id] || now - store[id]!.at > GUIDE_TTL);
      if (due.length === 0) { finish(); return; }
      setStatus({ running: true, done: 0, total: due.length });
      phase("TV guide", 0, due.length);
      for (let i = 0; i < due.length && !cancelled; i += GUIDE_BATCH) {
        const batch = due.slice(i, i + GUIDE_BATCH);
        try {
          const start = new Date(Date.now() - 60 * 60_000).toISOString();
          const end = new Date(Date.now() + GUIDE_SPAN).toISOString();
          const result = await fetchSchedules({ data: { playlistId, channelIds: batch, start, end } });
          mergeGuide(client, playlistId, result);
        } catch {
          /* provider hiccup — retry next sync */
        }
        setStatus({ running: true, done: Math.min(due.length, i + GUIDE_BATCH), total: due.length });
        phase("TV guide", Math.min(due.length, i + GUIDE_BATCH), due.length);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (!cancelled) finish();
    };

    const idle = window.setTimeout(() => void run(), force ? 0 : 1500);
    const interval = window.setInterval(() => void run(), GUIDE_TTL);
    return () => { cancelled = true; window.clearTimeout(idle); window.clearInterval(interval); };
  }, [playlistId, client, fetchCategories, fetchItems, fetchSchedules, force, request?.n]);

  return status;
}

const BACKFILL_BATCH = 20;
const BACKFILL_PAUSE = 15_000;
const doneKey = (playlistId: string, kind: string) => `streamdeck-backfilled:${playlistId}:${kind}`;

/** True while a video is playing in the page, so background work steps aside. */
function playing() {
  return [...document.querySelectorAll("video")].some((video) => !video.paused && !video.ended);
}

/**
 * Slowly fills in categories, artwork and cast for titles that have no saved
 * details yet. Results are merged into the on-device metadata cache.
 */
export function useTitleBackfill(playlistId: string | null) {
  const client = useQueryClient();
  const backfill = useServerFn(backfillTitles);
  const fetchCached = useServerFn(getCachedTitleMetadata);
  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    let timer = 0;
    const kinds = ["movie", "series"] as const;
    const step = async () => {
      if (cancelled) return;
      if (playing() || document.hidden) { timer = window.setTimeout(step, BACKFILL_PAUSE); return; }
      for (const kind of kinds) {
        const items = client.getQueryData<CatalogItem[]>(["system-catalogue", playlistId, kind]) ?? [];
        if (!items.length) continue;
        const summaryKey = ["cached-title-metadata", playlistId, kind, "summary"] as const;
        if (client.getQueryData(summaryKey) === undefined) {
          const saved: Record<string, TitleMetadata> = {};
          try {
            const names = items.map((item) => item.name);
            for (let index = 0; index < names.length && !cancelled; index += 5000) {
              Object.assign(saved, await fetchCached({ data: { playlistId, kind, names: names.slice(index, index + 5000) } }));
            }
            if (!cancelled) client.setQueryData(summaryKey, saved);
          } catch {
            /* Retry the saved metadata scan on the next mounted session. */
          }
        }
        let done: Set<string>;
        try { done = new Set(JSON.parse(localStorage.getItem(doneKey(playlistId, kind)) ?? "[]") as string[]); } catch { done = new Set(); }
        const known: Record<string, { cast?: string[] }> = {};
        for (const [, data] of client.getQueriesData<Record<string, { cast?: string[] }>>({ queryKey: ["cached-title-metadata", playlistId, kind] })) Object.assign(known, data ?? {});
        const batch = items.map((item) => item.name).filter((name) => !done.has(name) && !(known[name]?.cast?.length)).slice(0, BACKFILL_BATCH);
        if (!batch.length) continue;
        try {
          const result = await backfill({ data: { playlistId, kind, names: batch } });
          client.setQueriesData<Record<string, unknown>>({ queryKey: ["cached-title-metadata", playlistId, kind] }, (old) => ({ ...(old ?? {}), ...result }));
          client.setQueryData<Record<string, TitleMetadata>>(summaryKey, (old) => ({ ...(old ?? {}), ...result }));
          for (const name of batch) done.add(name);
          try { localStorage.setItem(doneKey(playlistId, kind), JSON.stringify([...done])); } catch { /* storage full */ }
        } catch { /* try again later */ }
        break;
      }
      timer = window.setTimeout(step, BACKFILL_PAUSE);
    };
    timer = window.setTimeout(step, 30_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [playlistId, client, backfill, fetchCached]);
}

/* ---------- Admin bulk title refresh (survives navigation) ---------- */

export interface BulkRefreshState { running: boolean; kind: "movie" | "series" | null; done: number; total: number; failed: number }
let bulkState: BulkRefreshState = { running: false, kind: null, done: 0, total: 0, failed: 0 };
let bulkCancel = false;
const bulkListeners = new Set<() => void>();
const setBulk = (next: Partial<BulkRefreshState>) => { bulkState = { ...bulkState, ...next }; bulkListeners.forEach((fn) => fn()); };

export function useBulkRefreshState() {
  return useSyncExternalStore(
    (fn) => { bulkListeners.add(fn); return () => bulkListeners.delete(fn); },
    () => bulkState,
    () => bulkState,
  );
}

export function stopBulkRefresh() { bulkCancel = true; }

/** Re-resolves every title missing a description or cast, in parallel batches. */
export async function runBulkRefresh(
  client: QueryClient,
  playlistId: string,
  kind: "movie" | "series",
  refresh: (input: { data: { kind: "movie" | "series"; names: string[] } }) => Promise<Record<string, TitleMetadata>>,
) {
  if (bulkState.running) return;
  const items = client.getQueryData<CatalogItem[]>(["system-catalogue", playlistId, kind]) ?? [];
  const known: Record<string, TitleMetadata> = {};
  for (const [, data] of client.getQueriesData<Record<string, TitleMetadata>>({ queryKey: ["cached-title-metadata", playlistId, kind] })) Object.assign(known, data ?? {});
  const names = [...new Set(items.map((item) => item.name))].filter((name) => !known[name]?.overview || !known[name]?.cast?.length);
  bulkCancel = false;
  setBulk({ running: true, kind, done: 0, total: names.length, failed: 0 });
  const BATCH = 40;
  const PARALLEL = 3;
  let cursor = 0;
  const worker = async () => {
    while (!bulkCancel && cursor < names.length) {
      const batch = names.slice(cursor, cursor + BATCH);
      cursor += BATCH;
      try {
        const result = await refresh({ data: { kind, names: batch } });
        client.setQueriesData<Record<string, unknown>>({ queryKey: ["cached-title-metadata", playlistId, kind] }, (old) => ({ ...(old ?? {}), ...result }));
        setBulk({ done: bulkState.done + batch.length });
      } catch {
        setBulk({ done: bulkState.done + batch.length, failed: bulkState.failed + batch.length });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  setBulk({ running: false });
  toast.success(bulkCancel ? "Details update stopped" : `Details update finished${bulkState.failed ? ` (${bulkState.failed.toLocaleString()} could not be updated)` : ""}`);
}
