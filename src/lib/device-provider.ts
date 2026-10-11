/**
 * On-device provider access for the Fire TV app. Many providers refuse our
 * servers (or answer them with empty lists) but accept the subscriber's own
 * device, so when the native bridge can fetch, provider calls run here using
 * the same parsing code the server uses. Browsers keep using the server.
 */
import { useCallback } from "react";
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
} from "./iptv.functions";
import type { CatalogKind, ChannelSchedule } from "./iptv-types";

export function hasDeviceFetch(): boolean {
  return typeof window !== "undefined" && typeof window.StreamDeckNative?.fetchText === "function";
}

const pending = new Map<string, (status: number, body: string) => void>();
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
  provider.setDeviceFetcher(
    (url, userAgent) =>
      new Promise<Response>((resolve, reject) => {
        const id = `f${++counter}`;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error("timeout"));
        }, 120_000);
        pending.set(id, (status, body) => {
          window.clearTimeout(timer);
          if (status <= 0) reject(new Error("unreachable"));
          else resolve(new Response(body, { status }));
        });
        window.StreamDeckNative!.fetchText!(id, url, userAgent);
      }),
  );
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
  return useCallback(
    async (opts: { data: TIn }) => {
      install();
      const playlistId = (opts.data as { playlistId?: string }).playlistId;
      if (hasDeviceFetch() && playlistId) {
        try {
          let source = sources.get(playlistId);
          if (!source) {
            source = loadSource({ data: { playlistId } });
            sources.set(playlistId, source);
            source.catch(() => sources.delete(playlistId));
          }
          return await local(await source, opts.data);
        } catch (error) {
          console.warn("[device-provider] on-device request failed, using server", error);
        }
      }
      return remote(opts) as Promise<TOut>;
    },
    [remote, local, loadSource],
  );
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
