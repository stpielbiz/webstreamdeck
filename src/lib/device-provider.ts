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

type CatalogInput = { playlistId: string; kind: CatalogKind; categoryId?: string; search?: string };

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
  return useDeviceFn(
    useServerFn((await_import_guard as unknown) as typeof getMovie) as never,
    (() => Promise.reject()) as never,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const await_import_guard = null;
