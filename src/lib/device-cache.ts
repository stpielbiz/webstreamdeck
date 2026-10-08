import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * On-device library cache (IndexedDB). Saved provider data is loaded into the
 * query cache before screens mount, so menus open instantly; screens then
 * refresh stale data in the background.
 */
const DB_NAME = "streamdeck-library";
const STORE = "queries";
const MAX_AGE = 7 * 24 * 60 * 60_000;

/** Query key prefixes worth keeping on the device. */
const PERSISTED = new Set([
  "playlists",
  "tv-live-categories",
  "tv-live-items",
  "system-catalogue",
  "cached-title-metadata",
  "categories",
  "items",
  "global-search-live",
  "global-search-movie",
  "global-search-series",
  "device-guide",
]);

interface Entry { key: string; queryKey: QueryKey; data: unknown; at: number; v?: number }

/** Bump when saved lists from older app versions must be re-downloaded. */
const CACHE_VERSION = 2;
/** Older servers cut movie/show lists off at 3,000 titles. */
export function isTruncatedCatalogue(queryKey: QueryKey, data: unknown) {
  return queryKey[0] === "system-catalogue" && Array.isArray(data) && data.length === 3000;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function readAll(): Promise<Entry[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Entry[]) ?? []);
    request.onerror = () => resolve([]);
  });
}

export async function writeEntry(queryKey: QueryKey, data: unknown, at = Date.now()) {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put({ key: JSON.stringify(queryKey), queryKey, data, at, v: CACHE_VERSION });
  } catch {
    /* quota or serialisation issue — skip */
  }
}

function shouldPersist(queryKey: QueryKey) {
  return typeof queryKey[0] === "string" && PERSISTED.has(queryKey[0]);
}

let hydrated: Promise<void> | null = null;
/** Load saved data into the query cache, then keep saving successful results. */
export function hydrateDeviceCache(client: QueryClient): Promise<void> {
  hydrated ??= (async () => {
    const entries = await readAll();
    const now = Date.now();
    for (const entry of entries) {
      if (now - entry.at > MAX_AGE) continue;
      if (client.getQueryData(entry.queryKey) !== undefined) continue;
      // Outdated or cut-off lists still show instantly but are marked stale so
      // they are downloaded again in the background.
      const outdated = entry.queryKey[0] === "system-catalogue" && ((entry.v ?? 1) < CACHE_VERSION || isTruncatedCatalogue(entry.queryKey, entry.data));
      client.setQueryData(entry.queryKey, entry.data, { updatedAt: outdated ? 1 : entry.at });
    }
    const pending = new Map<string, number>();
    client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const { queryKey, state } = event.query;
      if (!shouldPersist(queryKey)) return;
      const id = JSON.stringify(queryKey);
      const timer = pending.get(id);
      if (timer) window.clearTimeout(timer);
      pending.set(id, window.setTimeout(() => {
        pending.delete(id);
        void writeEntry(queryKey, state.data, state.dataUpdatedAt);
      }, 500));
    });
  })().catch(() => undefined);
  return hydrated;
}

/** Delete every saved entry for one playlist except shared title details. */
export async function clearPlaylistEntries(playlistId: string) {
  const db = await openDb();
  if (!db) return;
  const entries = await readAll();
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const entry of entries) {
        if (entry.queryKey[0] === "cached-title-metadata") continue;
        if (entry.queryKey.includes(playlistId)) store.delete(entry.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
