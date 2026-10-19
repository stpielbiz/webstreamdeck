import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";

import type { CatalogItem } from "./iptv-types";
import { listRecentChannels, touchRecentChannel, type RecentChannel } from "./recent-channels.functions";

export const RECENT_CATEGORY = "__recent";
export const FAVOURITES_CATEGORY = "__favourites";

export function useRecentChannels(playlistId: string | null) {
  const fetchRecent = useServerFn(listRecentChannels);
  const query = useQuery<RecentChannel[]>({ queryKey: ["recent-channels"], queryFn: () => fetchRecent(), staleTime: 60_000 });
  // Same list object until the data really changes: screens re-run work when
  // it changes, and a fresh list on every render looped the guide forever
  // (re-resolving the player's recent channels ~10 times a second).
  const rows = useMemo(
    () => (query.data ?? []).filter((row) => row.playlistId === playlistId).slice(0, 10),
    [query.data, playlistId],
  );
  return { ...query, rows };
}

/** Records a watched channel, updating the Recent list instantly. */
export function useTouchRecent() {
  const touch = useServerFn(touchRecentChannel);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: { playlistId: string; itemId: string; title: string; logoUrl: string | null }) => touch({ data: input }),
    onMutate: (input) => {
      queryClient.setQueryData<RecentChannel[]>(["recent-channels"], (old = []) => [
        input,
        ...old.filter((row) => !(row.playlistId === input.playlistId && row.itemId === input.itemId)),
      ]);
    },
    onSettled: () => {
      // Re-sync with the server so every screen sees the same order.
      void queryClient.invalidateQueries({ queryKey: ["recent-channels"] });
    },
  });
  return useCallback(
    (playlistId: string | null, item: CatalogItem) => {
      if (playlistId) mutation.mutate({ playlistId, itemId: item.id, title: item.name, logoUrl: item.image ?? null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutate],
  );
}

/** Order a channel list by the Recent rows, dropping channels not in it. */
export function orderByRecent(items: CatalogItem[], rows: RecentChannel[]): CatalogItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return rows.map((row) => byId.get(row.itemId)).filter((item): item is CatalogItem => !!item);
}
