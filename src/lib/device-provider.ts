/**
 * On-device provider access for the Fire TV app. Many providers refuse our
 * servers (or answer them with empty lists) but accept the subscriber's own
 * device, so when the native bridge can fetch, provider calls run here using
 * the same parsing code the server uses. Browsers keep using the server.
 */
import { useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import * as provider from "./iptv-provider";
import type { PlaylistRow } from "./iptv-provider";
import {
  getCategories,
  getItems,
  getMovie,
  getSeries,
  getNowNext,
  getPlayback,
  getPlaylistSource,
  getSchedule,
  getSchedules,
  testPlaylistConnection,
} from "./iptv.functions";
import type { CatalogKind, ChannelSchedule } from "./iptv-types";

export function hasDeviceFetch(): boolean {
  return typeof window !== "undefined" && typeof window.StreamDeckNative?.fetchText === "function";
}

const pending = new Map<string, (status: number, body: BodyInit | null) => void>();
let counter = 0;
let installed = false;

function install() {
  if (installed || !hasDeviceFetch()) return;
  installed = true;
  window.__streamDeckFetchDone = (id, status, body) => {
    const done = pending.get(id);
    pending.delete(id);
    done?.(status, body);
  };
  // Newer apps hand big bodies over as a same-origin download instead of a
  // giant script string, which used to stall (and run out of memory on) the page.
  window.__streamDeckFetchReady = (id, status) => {
    const done = pending.get(id);
    pending.delete(id);
    if (!done) return;
    if (status <= 0) { done(status, null); return; }
    fetch(`/__native-body/${encodeURIComponent(id)}`)
      .then((response) => done(status, response.body))
      .catch(() => done(0, null));
  };
  provider.setDeviceFetcher(
    (url, userAgent) =>
      new Promise<Response>((resolve, reject) => {
        const low = /action=get_(simple_data_table|short_epg)/.test(url);
        enqueue(low, () => {
          const id = `f${++counter}`;
          const finish = () => {
            inFlight -= 1;
            pump();
          };
          const timer = window.setTimeout(() => {
            pending.delete(id);
            finish();
            reject(new Error("timeout"));
          }, 120_000);
          pending.set(id, (status, body) => {
            window.clearTimeout(timer);
            finish();
            if (status <= 0) reject(new Error("unreachable"));
            else resolve(new Response(body, { status }));
          });
          const bridge = window.StreamDeckNative!;
          if (typeof bridge.fetchToUrl === "function") bridge.fetchToUrl(id, url, userAgent);
          else bridge.fetchText!(id, url, userAgent);
        });
      }),
  );
}

/*
 * The Firestick is slow: keep only a few provider requests in flight and pace
 * the background TV-guide requests so browsing and playback stay responsive.
 */
const MAX_IN_FLIGHT = 3;
const LOW_PRIORITY_GAP_MS = 250;
const highQueue: Array<() => void> = [];
const lowQueue: Array<() => void> = [];
let inFlight = 0;
let lastLowStart = 0;
let lowTimer: number | null = null;

function enqueue(low: boolean, start: () => void) {
  (low ? lowQueue : highQueue).push(start);
  pump();
}

function pump() {
  while (inFlight < MAX_IN_FLIGHT && highQueue.length) {
    inFlight += 1;
    highQueue.shift()!();
  }
  if (inFlight >= MAX_IN_FLIGHT - 1 || !lowQueue.length || lowTimer !== null) return;
  const wait = Math.max(0, lastLowStart + LOW_PRIORITY_GAP_MS - Date.now());
  lowTimer = window.setTimeout(() => {
    lowTimer = null;
    if (inFlight >= MAX_IN_FLIGHT - 1 || !lowQueue.length) return pump();
    inFlight += 1;
    lastLowStart = Date.now();
    lowQueue.shift()!();
    pump();
  }, wait);
}

const sources = new Map<string, Promise<PlaylistRow>>();

type Remote<T> = (opts: { data: T }) => Promise<any>;

/**
 * Same call shape as useServerFn(fn): on the Fire TV app it runs `local`
 * on-device and falls back to the server if that fails.
 */
function useDeviceFn<TIn, TOut>(
  remote: Remote<TIn>,
  local: (row: PlaylistRow, data: TIn) => Promise<TOut>,
): (opts: { data: TIn }) => Promise<TOut> {
  const loadSource = useServerFn(getPlaylistSource);
  // Callers list the returned function in effect dependencies, so it must keep
  // the same identity across renders; otherwise effects re-run every render
  // (re-resolving streams and relaunching the native player in a loop).
  const latest = useRef({ remote, local, loadSource });
  latest.current = { remote, local, loadSource };
  return useCallback(async (opts: { data: TIn }) => {
    const { remote, local, loadSource } = latest.current;
    install();
    const playlistId = (opts.data as { playlistId?: string }).playlistId;
    if (hasDeviceFetch() && playlistId) {
      try {
        let source = sources.get(playlistId);
        if (!source) {
          const created: Promise<PlaylistRow> = loadSource({ data: { playlistId } });
          sources.set(playlistId, created);
          created.catch(() => sources.delete(playlistId));
          source = created;
        }
        return await local(await source, opts.data);
      } catch (error) {
        console.warn("[device-provider] on-device request failed, using server", error);
      }
    }
    return remote(opts) as Promise<TOut>;
  }, []);
}

type CatalogInput = { playlistId: string; kind: CatalogKind; categoryId?: string | undefined; search?: string | undefined };

export function useGetCategories() {
  return useDeviceFn(useServerFn(getCategories) as Remote<Pick<CatalogInput, "playlistId" | "kind">>, (row, d) =>
    provider.fetchCategories(row, d.kind),
  );
}

export function useGetItems() {
  return useDeviceFn(useServerFn(getItems) as Remote<CatalogInput>, (row, d) =>
    provider.fetchItems(row, d.kind, d.categoryId, d.search),
  );
}

export function useGetMovie() {
  return useDeviceFn(useServerFn(getMovie) as Remote<{ playlistId: string; id: string }>, (row, d) =>
    provider.fetchMovie(row, d.id),
  );
}

export function useGetSeries() {
  return useDeviceFn(useServerFn(getSeries) as Remote<{ playlistId: string; id: string }>, (row, d) =>
    provider.fetchSeries(row, d.id),
  );
}

export function useGetNowNext() {
  return useDeviceFn(useServerFn(getNowNext) as Remote<{ playlistId: string; channelIds: string[] }>, (row, d) =>
    provider.fetchNowNext(row, d.channelIds),
  );
}

export function useGetSchedule() {
  return useDeviceFn(useServerFn(getSchedule) as Remote<{ playlistId: string; channelId: string }>, async (row, d) => {
    if (row.kind !== "xtream") return [];
    try {
      return await provider.xtreamSchedule(row, d.channelId);
    } catch {
      return [];
    }
  });
}

type SchedulesInput = { playlistId: string; channelIds: string[]; start: string; end: string };

export function useGetSchedules() {
  return useDeviceFn(useServerFn(getSchedules) as Remote<SchedulesInput>, async (row, d): Promise<ChannelSchedule[]> => {
    const windowStart = Date.parse(d.start);
    const windowEnd = Date.parse(d.end);
    if (row.kind !== "xtream" || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
      return d.channelIds.map((channelId) => ({ channelId, programmes: [] }));
    }
    const results: ChannelSchedule[] = [];
    const queue = [...d.channelIds];
    await Promise.all(
      Array.from({ length: Math.min(6, queue.length) }, async () => {
        for (;;) {
          const channelId = queue.shift();
          if (!channelId) return;
          try {
            const programmes = (await provider.xtreamSchedule(row, channelId)).filter((programme) => {
              const start = Date.parse(programme.start ?? "");
              const end = Date.parse(programme.end ?? "");
              return Number.isFinite(start) && Number.isFinite(end) && end > windowStart && start < windowEnd;
            });
            results.push({ channelId, programmes });
          } catch {
            results.push({ channelId, programmes: [] });
          }
        }
      }),
    );
    return results;
  });
}

type PlaybackInput = { playlistId: string; kind: "live" | "movie" | "episode"; itemId: string; ext?: string | null | undefined };

export function useGetPlayback() {
  return useDeviceFn(useServerFn(getPlayback) as Remote<PlaybackInput>, async (row, d) => {
    const upstream = await provider.resolveStreamUrl(row, d.kind, d.itemId, d.ext ?? undefined);
    return { url: upstream, directUrl: upstream as string | null, live: d.kind === "live" };
  });
}

/** Checks a saved playlist answers now — on the Fire TV's own connection when available. */
export function useTestConnection() {
  return useDeviceFn(useServerFn(testPlaylistConnection) as Remote<{ playlistId: string }>, (row) =>
    provider.testConnection(row),
  );
}
