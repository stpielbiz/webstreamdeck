import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { mediaMatchKey as normTitle } from "@/lib/title-variants";
import type { ProgressRow } from "./iptv.functions";
import type { CatalogItem } from "./iptv-types";
import { getSettings, saveSettings, type UserSettings } from "./settings.functions";

export function useSettings() {
  const fetchSettings = useServerFn(getSettings);
  return useQuery<UserSettings>({ queryKey: ["user-settings"], queryFn: () => fetchSettings(), staleTime: 5 * 60_000 });
}

export function useSaveSettings() {
  const client = useQueryClient();
  const save = useServerFn(saveSettings);
  return useMutation({
    mutationFn: (input: UserSettings) => save({ data: input }),
    onSuccess: (data) => {
      client.setQueryData(["user-settings"], data);
      void client.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}

export function useSyncPlaylists() {
  return useSettings().data?.syncPlaylists ?? false;
}

export function useTvScreenSize() {
  return useSettings().data?.screenSize ?? "large";
}

/** Show name of an episode progress title ("Show — S1E2 …" → "Show"). */
const showName = (title: string) => title.replace(/\s+[—-]\s+S\d+.*$/i, "");

/**
 * Resume point for a title. Exact playlist/item match first; with playlist
 * sync on, falls back to the same title watched on another playlist.
 */
export function findResume(
  rows: ProgressRow[] | undefined,
  activeId: string | null,
  target: { itemId: string; title?: string | null | undefined; season?: number | null | undefined; episode?: number | null | undefined },
  sync: boolean,
): ProgressRow | undefined {
  const list = rows ?? [];
  const exact = list.find((row) => row.playlistId === activeId && row.itemId === target.itemId);
  if (exact || !sync || !target.title) return exact;
  const key = normTitle(target.title);
  if (!key) return undefined;
  return list.find((row) =>
    row.playlistId !== activeId
    && !row.external
    && normTitle(row.title) === key
    && (target.season == null || row.season === target.season)
    && (target.episode == null || row.episode === target.episode),
  );
}

/**
 * Continue-watching rows for the active playlist. With sync on, rows from
 * other playlists are remapped to the same title in the active playlist and
 * dropped when that playlist doesn't carry it.
 */
export function syncedResumeRows(
  rows: ProgressRow[] | undefined,
  activeId: string | null,
  sync: boolean,
  movies: CatalogItem[] | undefined,
  shows: CatalogItem[] | undefined,
): ProgressRow[] {
  const own = (rows ?? []).filter((row) => row.playlistId === activeId);
  if (!sync) return own;
  const movieIndex = new Map((movies ?? []).map((item) => [normTitle(item.name), item.id]));
  const showIndex = new Map((shows ?? []).map((item) => [normTitle(item.name), item.id]));
  const seen = new Set(own.map((row) => (row.itemKind === "episode" ? `s:${normTitle(showName(row.title))}` : `m:${normTitle(row.title)}`)));
  const out = [...own];
  for (const row of rows ?? []) {
    if (row.playlistId === activeId || row.external) continue;
    if (row.itemKind === "movie") {
      const key = normTitle(row.title);
      const id = movieIndex.get(key);
      if (!id || seen.has(`m:${key}`)) continue;
      seen.add(`m:${key}`);
      out.push({ ...row, playlistId: activeId ?? row.playlistId, itemId: id });
    } else if (row.itemKind === "episode") {
      const key = normTitle(showName(row.title));
      const id = showIndex.get(key);
      if (!id || seen.has(`s:${key}`)) continue;
      seen.add(`s:${key}`);
      out.push({ ...row, playlistId: activeId ?? row.playlistId, seriesId: id });
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
