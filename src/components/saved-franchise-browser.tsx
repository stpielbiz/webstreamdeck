import { useGetItems } from "@/lib/device-provider";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useFranchiseMatches } from "@/components/franchise-list";
import { FranchiseCollectionPage } from "@/components/franchise-collection";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { useRemoveSavedFranchise, useSavedFranchises } from "@/lib/saved-franchises";

export function SavedFranchiseBrowser({ tv, onBack }: { tv?: boolean; onBack: () => void }) {
  const { activeId } = usePlaylists();
  const fetchItems = useGetItems();
  const saved = useSavedFranchises();
  const remove = useRemoveSavedFranchise();
  const [openId, setOpenId] = useState<string | null>(null);
  const options = (kind: "movie" | "series") => ({
    queryKey: ["system-catalogue", activeId, kind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind } }),
    enabled: !!activeId,
    staleTime: 30 * 60_000,
  });
  const movies = useQuery(options("movie"));
  const shows = useQuery(options("series"));
  const selected = saved.data?.find((item) => item.id === openId) ?? null;

  const close = () => {
    const id = openId;
    setOpenId(null);
    window.requestAnimationFrame(() => { if (id) document.querySelector<HTMLElement>(`[data-focus-key="franchise-${CSS.escape(id)}"]`)?.focus(); });
  };

  if (selected) {
    return (
      <section className="mx-auto w-full max-w-5xl p-3 sm:p-6">
        <FranchiseCollectionPage franchise={selected} movies={movies.data} shows={shows.data} onBack={close} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6">
      <div className="flex items-center gap-3">
        <Button data-layer-back data-tv-focus variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Home</Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Franchise</h1>
          <p className="text-sm text-muted-foreground">Pick a collection to see every movie and show in it.</p>
        </div>
      </div>
      {saved.isLoading ? <p className="text-sm text-muted-foreground">Loading saved lists…</p> : saved.data?.length ? (
        <div className={tv ? "grid grid-cols-5 gap-4" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"}>
          {saved.data.map((franchise, index) => (
            <PosterCard key={franchise.id} franchise={franchise} movies={movies.data} shows={shows.data} first={index === 0} onOpen={() => setOpenId(franchise.id)} onRemove={async () => {
              try { await remove.mutateAsync(franchise.id); toast.success(`${franchise.name} removed`); }
              catch { toast.error("The list could not be removed"); }
            }} />
          ))}
        </div>
      ) : <p className="rounded border border-border p-5 text-sm text-muted-foreground">Open a movie or show and create a related franchise list to see it here.</p>}
    </section>
  );
}

function PosterCard({ franchise, movies, shows, first, onOpen, onRemove }: {
  franchise: NonNullable<ReturnType<typeof useSavedFranchises>["data"]>[number];
  movies?: Parameters<typeof useFranchiseMatches>[1];
  shows?: Parameters<typeof useFranchiseMatches>[2];
  first: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const matches = useFranchiseMatches(franchise, movies, shows);
  const owned = useMemo(() => matches.filter((item) => item.group).length, [matches]);
  const poster = useMemo(() => {
    const withArt = matches.filter((m) => m.group?.item.image);
    withArt.sort((a, b) => (Number(b.member.year ?? b.group?.year ?? 0)) - (Number(a.member.year ?? a.group?.year ?? 0)));
    return withArt[0]?.group?.item.image ?? null;
  }, [matches]);
  return (
    <article className="flex flex-col gap-2" data-remote-row>
      <button type="button" data-tv-focus data-zone-entry={first ? "true" : undefined} data-focus-key={`franchise-${franchise.id}`} onClick={onOpen}
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted outline-none focus:ring-4 focus:ring-primary">
        {poster ? <img src={poster} alt="" loading="lazy" className="size-full object-cover" /> : <Layers className="absolute inset-0 m-auto size-10 text-muted-foreground" />}
      </button>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-semibold">{franchise.name}</h2>
          <p className="text-xs text-muted-foreground">{owned} of {franchise.members.length} in your library</p>
        </div>
        <Button data-tv-focus size="icon" variant="ghost" className="size-8" title={`Remove ${franchise.name}`} onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
    </article>
  );
}
