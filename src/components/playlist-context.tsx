import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hydrateDeviceCache } from "@/lib/device-cache";
import { useLibrarySync, useTitleBackfill, type SyncStatus } from "@/lib/library-sync";
import { useServerFn } from "@tanstack/react-start";

import { listPlaylists, type PlaylistSummary } from "@/lib/iptv.functions";

interface PlaylistContextValue {
  playlists: PlaylistSummary[];
  active: PlaylistSummary | null;
  activeId: string | null;
  setActiveId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
  sync: SyncStatus;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);
const STORAGE_KEY = "streamdeck.activePlaylist";

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void hydrateDeviceCache(client).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [client]);
  if (!ready) return null;
  return <PlaylistProviderInner>{children}</PlaylistProviderInner>;
}

function PlaylistProviderInner({ children }: { children: ReactNode }) {
  const fetchPlaylists = useServerFn(listPlaylists);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => fetchPlaylists(),
    staleTime: 60_000,
  });

  const playlists = data ?? [];

  useEffect(() => {
    if (playlists.length === 0) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const valid =
      (stored && playlists.find((playlist) => playlist.id === stored)?.id) || playlists[0]!.id;
    setActiveIdState((current) =>
      current && playlists.some((playlist) => playlist.id === current) ? current : valid,
    );
  }, [playlists]);

  const sync = useLibrarySync(activeId);
  useTitleBackfill(activeId);
  const value = useMemo<PlaylistContextValue>(
    () => ({
      playlists,
      activeId,
      active: playlists.find((playlist) => playlist.id === activeId) ?? null,
      setActiveId: (id: string) => {
        window.localStorage.setItem(STORAGE_KEY, id);
        setActiveIdState(id);
      },
      isLoading,
      refetch: () => void refetch(),
      sync,
    }),
    [playlists, activeId, isLoading, refetch, sync],
  );

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
}

export function usePlaylists(): PlaylistContextValue {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error("usePlaylists must be used inside PlaylistProvider");
  return context;
}
