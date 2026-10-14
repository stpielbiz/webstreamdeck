import { useGetItems } from "@/lib/device-provider";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFranchiseMatches } from "@/components/franchise-list";
import { FranchiseCollectionPage } from "@/components/franchise-collection";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRemoveSavedFranchise, useSavedFranchises } from "@/lib/saved-franchises";
import { useLongPress } from "@/lib/use-long-press";

type Saved = NonNullable<ReturnType<typeof useSavedFranchises>["data"]>[number];

export function SavedFranchiseBrowser({ tv, onBack }: { tv?: boolean; onBack: () => void }) {
  const { activeId } = usePlaylists();
  const fetchItems = useGetItems();
  const saved = useSavedFranchises();
  const remove = useRemoveSavedFranchise();
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Saved | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const options = (kind: "movie" | "series") => ({
    queryKey: ["system-catalogue", activeId, kind],
    queryFn: () => fetchItems({ data: { playlistId: activeId ?? "", kind } }),
    enabled: !!activeId,
    staleTime: 30 * 60_000,
  });
  const movies = useQuery(options("movie"));
  const shows = useQuery(options("series"));
  const selected = saved.data?.find((item) => item.id === openId) ?? null;

  const cards = () => Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-franchise-card]") ?? []);
  const focusIndex = (index: number) => window.requestAnimationFrame(() => {
    const list = cards();
    if (list.length) list[Math.max(0, Math.min(index, list.length - 1))].focus();
    else backRef.current?.focus();
  });

  const close = () => {
    const id = openId;
    setOpenId(null);
    window.requestAnimationFrame(() => { if (id) document.querySelector<HTMLElement>(`[data-focus-key="franchise-${CSS.escape(id)}"]`)?.focus(); });
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const list = cards();
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    const cols = Math.max(1, getComputedStyle(gridRef.current!).gridTemplateColumns.split(" ").filter(Boolean).length);
    let next = current;
    if (event.key === "ArrowLeft") next = current - 1;
    else if (event.key === "ArrowRight") next = current + 1;
    else if (event.key === "ArrowUp") next = current - cols;
    else if (event.key === "ArrowDown") next = current + cols;
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (next < 0) { if (event.key === "ArrowUp") backRef.current?.focus(); return; }
    if (next >= list.length) {
      // Down from a partial last row lands on the final card.
      if (event.key === "ArrowDown" && Math.floor(current / cols) < Math.floor((list.length - 1) / cols)) list[list.length - 1].focus();
      return;
    }
    list[next].focus();
  };

  if (selected) {
    return (
      <section className="mx-auto w-full max-w-5xl p-3 sm:p-6">
        <FranchiseCollectionPage franchise={selected} movies={movies.data} shows={shows.data} onBack={close} />
      </section>
    );
  }

  const confirmRemove = async () => {
    if (!removing) return;
    const index = saved.data?.findIndex((item) => item.id === removing.id) ?? 0;
    const target = removing;
    setRemoving(null);
    try { await remove.mutateAsync(target.id); toast.success(`${target.name} removed`); }
    catch { toast.error("The list could not be removed"); }
    focusIndex(index);
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6">
      <div className="flex items-center gap-3" data-remote-row>
        <Button ref={backRef} data-layer-back data-tv-focus variant="ghost" size="sm" onClick={onBack}
          onKeyDown={(event) => { if (event.key === "ArrowDown" && cards().length) { event.preventDefault(); event.stopPropagation(); cards()[0].focus(); } }}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Franchise</h1>
          <p className="text-sm text-muted-foreground">Pick a collection to see every movie and show in it. Hold OK to remove one.</p>
        </div>
      </div>
      {saved.isLoading ? <p className="text-sm text-muted-foreground">Loading saved lists…</p> : saved.data?.length ? (
        <div ref={gridRef} data-remote-row onKeyDownCapture={onGridKey} className={tv ? "grid grid-cols-5 gap-4" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"}>
          {saved.data.map((franchise, index) => (
            <PosterCard key={franchise.id} franchise={franchise} movies={movies.data} shows={shows.data} first={index === 0}
              onOpen={() => setOpenId(franchise.id)} onHold={() => setRemoving(franchise)} />
          ))}
        </div>
      ) : <p className="rounded border border-border p-5 text-sm text-muted-foreground">Open a movie or show and create a related franchise list to see it here.</p>}

      <Dialog open={removing !== null} onOpenChange={(value) => { if (!value) setRemoving(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove this franchise?</DialogTitle></DialogHeader>
          <p className="truncate text-sm text-muted-foreground">{removing?.name}</p>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline" data-dialog-back data-tv-focus>Cancel</Button></DialogClose>
            <Button data-tv-focus autoFocus onClick={() => void confirmRemove()}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PosterCard({ franchise, movies, shows, first, onOpen, onHold }: {
  franchise: Saved;
  movies?: Parameters<typeof useFranchiseMatches>[1];
  shows?: Parameters<typeof useFranchiseMatches>[2];
  first: boolean;
  onOpen: () => void;
  onHold: () => void;
}) {
  const matches = useFranchiseMatches(franchise, movies, shows);
  const owned = useMemo(() => matches.filter((item) => item.group).length, [matches]);
  const poster = useMemo(() => {
    const withArt = matches.filter((m) => m.group?.item.image);
    withArt.sort((a, b) => (Number(b.member.year ?? b.group?.year ?? 0)) - (Number(a.member.year ?? a.group?.year ?? 0)));
    return withArt[0]?.group?.item.image ?? null;
  }, [matches]);
  const longPress = useLongPress(onHold);
  return (
    <article className="flex flex-col gap-2">
      <button type="button" data-tv-focus data-franchise-card data-zone-entry={first ? "true" : undefined} data-focus-key={`franchise-${franchise.id}`}
        title={`${franchise.name} — hold OK to remove`} onClick={onOpen} {...longPress}
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted outline-none focus:ring-4 focus:ring-primary">
        {poster ? <img src={poster} alt="" loading="lazy" className="size-full object-cover" /> : <Layers className="absolute inset-0 m-auto size-10 text-muted-foreground" />}
      </button>
      <div className="min-w-0">
        <h2 className="truncate font-display text-sm font-semibold">{franchise.name}</h2>
        <p className="text-xs text-muted-foreground">{owned} of {franchise.members.length} in your library</p>
      </div>
    </article>
  );
}
