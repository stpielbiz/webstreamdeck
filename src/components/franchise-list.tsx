import { useState } from "react";
import { Layers } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TitleDetailsDialog } from "@/components/title-details-dialog";
import type { CatalogItem } from "@/lib/iptv-types";
import type { Franchise } from "@/lib/franchise.functions";
import type { TitleGroup } from "@/lib/title-variants";
import { useFranchiseMatches } from "@/components/franchise-details";
export { useFranchiseMatches } from "@/components/franchise-details";
import { cn } from "@/lib/utils";

export function FranchiseCard({ franchise, owned, onOpen }: { franchise: Franchise; owned: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-tv-focus
      data-focus-key="global-result-first"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded border border-primary/40 bg-card px-3 py-2 text-left outline-none focus:bg-secondary focus:ring-2 focus:ring-primary"
    >
      <Layers className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{franchise.name}</span>
        <span className="block text-xs text-muted-foreground">{owned} of {franchise.members.length} titles in your library · open the full list</span>
      </span>
    </button>
  );
}

export function FranchiseList({ franchise, movies, shows, open, onClose }: {
  franchise: Franchise | null; movies?: CatalogItem[] | undefined; shows?: CatalogItem[] | undefined; open: boolean; onClose: () => void;
}) {
  const [order, setOrder] = useState<"year" | "story">("year");
  const [picked, setPicked] = useState<{ kind: "movie" | "series"; group: TitleGroup } | null>(null);
  const matches = useFranchiseMatches(franchise, movies, shows);
  const sorted = [...matches].sort((a, b) =>
    order === "story" ? a.member.story_index - b.member.story_index : (a.member.year ?? 9999) - (b.member.year ?? 9999));

  return (
    <>
      <Dialog open={open && !picked} onOpenChange={(value) => { if (!value) onClose(); }}>
        <DialogContent className="max-w-xl" onKeyDown={(event) => {
          if (!franchise?.hasStoryOrder) return;
          if (event.key === "ArrowLeft") setOrder("year");
          if (event.key === "ArrowRight") setOrder("story");
        }}>
          <DialogHeader><DialogTitle>{franchise?.name}</DialogTitle></DialogHeader>
          {franchise?.hasStoryOrder && (
            <div className="flex gap-2">
              <Button size="sm" variant={order === "year" ? "default" : "secondary"} onClick={() => setOrder("year")}>By year</Button>
              <Button size="sm" variant={order === "story" ? "default" : "secondary"} onClick={() => setOrder("story")}>Story order</Button>
            </div>
          )}
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto p-1">
            {sorted.map(({ member, group }, i) => (
              <li key={`${member.title}-${member.year}`}>
                <button
                  type="button"
                  data-tv-focus
                  autoFocus={i === 0}
                  disabled={!group}
                  onClick={() => group && setPicked({ kind: member.kind, group })}
                  className={cn("flex w-full items-center gap-3 rounded px-2 py-1.5 text-left outline-none focus:bg-secondary focus:ring-2 focus:ring-primary", !group && "opacity-50")}
                >
                  <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
                  <span className="grid h-12 w-8 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                    {group?.item.image && <img src={group.item.image} alt="" loading="lazy" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{member.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {member.year ?? "—"} · {member.kind === "movie" ? "Movie" : "Show"}{!group && " · Not in your list"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <TitleDetailsDialog kind={picked?.kind ?? "movie"} id={picked?.group.item.id ?? null} name={picked?.group.title} image={picked?.group.item.image} year={picked?.group.year} variants={picked?.group.variants} onClose={() => setPicked(null)} />
    </>
  );
}
