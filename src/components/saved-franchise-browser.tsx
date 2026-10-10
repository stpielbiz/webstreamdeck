import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Layers, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FranchiseList, useFranchiseMatches } from "@/components/franchise-list";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { getItems } from "@/lib/iptv.functions";
import { useRemoveSavedFranchise, useSavedFranchises } from "@/lib/saved-franchises";

export function SavedFranchiseBrowser({ tv, onBack }: { tv?: boolean; onBack: () => void }) {
  const { activeId } = usePlaylists();
  const fetchItems = useServerFn(getItems);
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

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 p-3 sm:p-6">
      <div className="flex items-center gap-3">
        <Button data-layer-back data-tv-focus variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Sections</Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Franchise</h1>
          <p className="text-sm text-muted-foreground">Your saved movie and show collections.</p>
        </div>
      </div>
      {saved.isLoading ? <p className="text-sm text-muted-foreground">Loading saved lists…</p> : saved.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saved.data.map((franchise, index) => (
            <SavedCard key={franchise.id} franchise={franchise} movies={movies.data} shows={shows.data} first={index === 0} onOpen={() => setOpenId(franchise.id)} onRemove={async () => {
              try { await remove.mutateAsync(franchise.id); toast.success(`${franchise.name} removed`); }
              catch { toast.error("The list could not be removed"); }
            }} />
          ))}
        </div>
      ) : <p className="rounded border border-border p-5 text-sm text-muted-foreground">Open a movie or show and create a related franchise list to see it here.</p>}
      <FranchiseList franchise={selected} movies={movies.data} shows={shows.data} open={!!selected} onClose={() => setOpenId(null)} />
    </section>
  );
}

function SavedCard({ franchise, movies, shows, first, onOpen, onRemove }: {
  franchise: NonNullable<ReturnType<typeof useSavedFranchises>["data"]>[number];
  movies?: Parameters<typeof useFranchiseMatches>[1];
  shows?: Parameters<typeof useFranchiseMatches>[2];
  first: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const matches = useFranchiseMatches(franchise, movies, shows);
  const owned = useMemo(() => matches.filter((item) => item.group).length, [matches]);
  return (
    <article className="flex min-h-36 flex-col rounded border border-border bg-card p-4">
      <Layers className="mb-3 size-5 text-primary" />
      <h2 className="font-display text-lg font-semibold">{franchise.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{owned} of {franchise.members.length} titles in your library</p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button data-tv-focus data-zone-entry={first ? "true" : undefined} className="flex-1" onClick={onOpen}>Open list</Button>
        <Button data-tv-focus size="icon" variant="ghost" title={`Remove ${franchise.name}`} onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
    </article>
  );
}