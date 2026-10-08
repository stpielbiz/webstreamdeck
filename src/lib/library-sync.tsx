import { clearPlaylistEntries, isTruncatedCatalogue } from "@/lib/device-cache";
import { toast } from "sonner";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCategories, getItems, getSchedules } from "@/lib/iptv.functions";
import { backfillTitles } from "@/lib/metadata.functions";
import type { CatalogItem, Programme } from "@/lib/iptv-types";

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
      try {
        const data = await fn();
        client.setQueryData(key, data);
        return data;
      } catch {
        return client.getQueryData<T>(key);
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
        let done: Set<string>;
        try { done = new Set(JSON.parse(localStorage.getItem(doneKey(playlistId, kind)) ?? "[]") as string[]); } catch { done = new Set(); }
        const known: Record<string, { cast?: string[] }> = {};
        for (const [, data] of client.getQueriesData<Record<string, { cast?: string[] }>>({ queryKey: ["cached-title-metadata", playlistId, kind] })) Object.assign(known, data ?? {});
        const batch = items.map((item) => item.name).filter((name) => !done.has(name) && !(known[name]?.cast?.length)).slice(0, BACKFILL_BATCH);
        if (!batch.length) continue;
        try {
          const result = await backfill({ data: { playlistId, kind, names: batch } });
          client.setQueriesData<Record<string, unknown>>({ queryKey: ["cached-title-metadata", playlistId, kind] }, (old) => ({ ...(old ?? {}), ...result }));
          for (const name of batch) done.add(name);
          try { localStorage.setItem(doneKey(playlistId, kind), JSON.stringify([...done])); } catch { /* storage full */ }
        } catch { /* try again later */ }
        break;
      }
      timer = window.setTimeout(step, BACKFILL_PAUSE);
    };
    timer = window.setTimeout(step, 30_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [playlistId, client, backfill]);
}
