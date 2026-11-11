import { debugLog } from "@/lib/debug-log";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import {
  clearProgress,
  listFavorites,
  listProgress,
  saveProgress,
  toggleFavorite,
  type FavoriteRow,
  type ProgressRow,
} from "./iptv.functions";

export function useFavorites() {
  const fetchFavorites = useServerFn(listFavorites);
  return useQuery<FavoriteRow[]>({
    queryKey: ["favorites"],
    queryFn: () => fetchFavorites(),
    staleTime: 30_000,
  });
}

export function useProgress() {
  const fetchProgress = useServerFn(listProgress);
  return useQuery<ProgressRow[]>({
    queryKey: ["progress"],
    queryFn: () => fetchProgress(),
    staleTime: 15_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const mutate = useServerFn(toggleFavorite);
  return useMutation({
    mutationFn: (input: {
      playlistId: string;
      itemKind: "live" | "movie" | "series" | "episode" | "live_category";
      itemId: string;
      title: string;
      logoUrl?: string | null;
    }) => mutate({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["favorites"] });
      const previous = queryClient.getQueryData<FavoriteRow[]>(["favorites"]);
      const matches = (row: FavoriteRow) =>
        row.playlistId === input.playlistId && row.itemKind === input.itemKind && row.itemId === input.itemId;
      const existing = previous?.find(matches);
      const next = existing
        ? (previous ?? []).filter((row) => row.id !== existing.id)
        : [
            {
              id: `pending-${input.playlistId}-${input.itemKind}-${input.itemId}`,
              playlistId: input.playlistId,
              itemKind: input.itemKind,
              itemId: input.itemId,
              title: input.title,
              logoUrl: input.logoUrl ?? null,
            } satisfies FavoriteRow,
            ...(previous ?? []),
          ];
      queryClient.setQueryData<FavoriteRow[]>(["favorites"], next);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(["favorites"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export function useClearProgress() {
  const queryClient = useQueryClient();
  const clear = useServerFn(clearProgress);
  return useMutation({
    mutationFn: (input: { playlistId: string; itemId: string }) => clear({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress"] }),
  });
}

export function useSaveProgress() {
  const queryClient = useQueryClient();
  const save = useServerFn(saveProgress);
  return useCallback(
    async (input: {
      playlistId: string;
      itemKind: "movie" | "episode";
      itemId: string;
      seriesId?: string | null;
      season?: number | null;
      episode?: number | null;
      title: string;
      posterUrl?: string | null;
      positionSeconds: number;
      durationSeconds?: number | null;
      external?: boolean;
    }) => {
      // Retry a few times (e.g. while sign-in renews) instead of dropping it.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await save({ data: input });
          if (attempt > 0) debugLog("progress", `Saved after retry: ${input.title}`, { positionSeconds: Math.round(input.positionSeconds) });
          void queryClient.invalidateQueries({ queryKey: ["progress"] });
          return;
        } catch (error) {
          debugLog("progress", `Save failed (attempt ${attempt + 1}): ${input.title}`, { positionSeconds: Math.round(input.positionSeconds), error: String(error) });
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
    },
    [save, queryClient],
  );
}

export function isFavorite(
  favorites: FavoriteRow[] | undefined,
  playlistId: string | null,
  itemKind: string,
  itemId: string,
): boolean {
  if (!favorites || !playlistId) return false;
  return favorites.some(
    (favorite) =>
      favorite.playlistId === playlistId &&
      favorite.itemKind === itemKind &&
      favorite.itemId === itemId,
  );
}

/** Favourite lists and categories read A–Z by title. */
export function compareTitles(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
