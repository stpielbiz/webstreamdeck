import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import {
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
      itemKind: "live" | "movie" | "series" | "episode";
      itemId: string;
      title: string;
      logoUrl?: string | null;
    }) => mutate({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
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
    }) => {
      try {
        await save({ data: input });
        void queryClient.invalidateQueries({ queryKey: ["progress"] });
      } catch {
        /* progress saving is best-effort */
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
