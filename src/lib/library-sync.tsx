import { isTruncatedCatalogue } from "@/lib/device-cache";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    const stale = (key: readonly unknown[], ttl: number) => {
      const state = client.getQueryState(key);
      return !state?.dataUpdatedAt || Date.now() - state.dataUpdatedAt > ttl || isTruncatedCatalogue(key, state.data);
    };
    const refresh = async <T,>(key: readonly unknown[], fn: () => Promise<T>) => {
      if (!stale(key, LIBRARY_TTL)) return client.getQueryData<T>(key);
      try {
        const data = await fn();
        client.setQueryData(key, data);
        return data;
      } catch {
        return client.getQueryData<T>(key);
      }
    };

    const run = async () => {
      const first = client.getQueryData(["tv-live-items", playlistId, ""]) === undefined;
      if (first) setStatus({ running: true, done: 0, total: 0 });
      await refresh(["tv-live-categories", playlistId], () => fetchCategories({ data: { playlistId, kind: "live" } }));
      const channels = await refresh<CatalogItem[]>(["tv-live-items", playlistId, ""], () => fetchItems({ data: { playlistId, kind: "live" } }));
      if (channels) client.setQueryData(["global-search-live", playlistId, "live"], channels);
      if (cancelled) return;
      await refresh(["system-catalogue", playlistId, "movie"], () => fetchItems({ data: { playlistId, kind: "movie" } }));
      await refresh(["system-catalogue", playlistId, "series"], () => fetchItems({ data: { playlistId, kind: "series" } }));
      if (cancelled || !channels?.length) { setStatus({ running: false, done: 0, total: 0 }); return; }

      // Guide: only channels missing from the saved copy or older than the TTL.
      const store = client.getQueryData<GuideStore>(guideKey(playlistId)) ?? {};
      const now = Date.now();
      const due = channels.slice(0, GUIDE_MAX_CHANNELS).map((c) => c.id).filter((id) => !store[id] || now - store[id]!.at > GUIDE_TTL);
      if (due.length === 0) { setStatus({ running: false, done: 0, total: 0 }); return; }
      setStatus({ running: true, done: 0, total: due.length });
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
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (!cancelled) setStatus({ running: false, done: 0, total: 0 });
    };

    const idle = window.setTimeout(() => void run(), 1500);
    const interval = window.setInterval(() => void run(), GUIDE_TTL);
    return () => { cancelled = true; window.clearTimeout(idle); window.clearInterval(interval); };
  }, [playlistId, client, fetchCategories, fetchItems, fetchSchedules]);

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
