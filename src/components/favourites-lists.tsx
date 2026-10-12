import { useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, MonitorPlay, Play, Star, Tv } from "lucide-react";
import { usePlaylists } from "@/components/playlist-context";
import { Button } from "@/components/ui/button";
import { TitleDetailsDialog } from "@/components/title-details-dialog";
import { useFavorites, useToggleFavorite } from "@/lib/library-hooks";
import type { FavoriteRow } from "@/lib/iptv.functions";
import type { CatalogItem } from "@/lib/iptv-types";
import { mediaMatchKey, variantsForItem } from "@/lib/title-variants";
import { useSyncPlaylists } from "@/lib/playlist-sync";
import { useLongPress } from "@/lib/use-long-press";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { toast } from "sonner";

function FavouriteOpenButton({
  row,
  column,
  index,
  onOpen,
  onRemove,
  className,
  children,
}: {
  row: FavoriteRow;
  column: number;
  index: number;
  onOpen: () => void;
  onRemove: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const longPress = useLongPress(onRemove);
  return (
    <Button
      variant="ghost"
      data-tv-focus
      data-favourite-col={column}
      data-favourite-row={index}
      data-favourite-action="open"
      data-zone-edge-left={column === 0 ? "true" : undefined}
      onClick={onOpen}
      title={`${row.title} — hold OK to remove from favourites`}
      {...longPress}
      className={className}
    >
      {children}
    </Button>
  );
}

const GROUPS = [
  { kind: "live", title: "Channels", icon: Tv },
  { kind: "movie", title: "Movies", icon: Clapperboard },
  { kind: "series", title: "Shows", icon: MonitorPlay },
] as const;

export function FavouritesLists({ tv = false, home = false }: { tv?: boolean; home?: boolean }) {
  const { activeId } = usePlaylists();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const navigate = useNavigate();
  const client = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<(FavoriteRow & { openId: string }) | null>(null);
  const [removing, setRemoving] = useState<FavoriteRow | null>(null);
  const sync = useSyncPlaylists();
  const all = favorites.data ?? [];
  const own = all.filter((row) => row.playlistId === activeId).map((row) => ({ ...row, openId: row.itemId }));
  const rows = [...own];
  if (sync && activeId) {
    const seen = new Set(own.map((row) => `${row.itemKind}:${mediaMatchKey(row.title)}`));
    const index = new Map<string, Map<string, string>>();
    for (const kind of ["movie", "series"] as const) {
      index.set(kind, new Map((client.getQueryData<CatalogItem[]>(["system-catalogue", activeId, kind]) ?? []).map((item) => [mediaMatchKey(item.name), item.id])));
    }
    for (const row of all) {
      if (row.playlistId === activeId || row.itemKind === "live") continue;
      const key = `${row.itemKind}:${mediaMatchKey(row.title)}`;
      const id = index.get(row.itemKind)?.get(mediaMatchKey(row.title));
      if (!id || seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...row, openId: id });
    }
  }
  const variants = selected && activeId && (selected.itemKind === "movie" || selected.itemKind === "series")
    ? variantsForItem(client.getQueryData<CatalogItem[]>(["system-catalogue", activeId, selected.itemKind]) ?? [], selected.openId)
    : [];

  const open = (row: FavoriteRow & { openId: string }) => {
    if (row.itemKind === "live") {
      void navigate(tv ? { to: "/tv/live", search: { channel: row.itemId } } : { to: "/live", search: { channel: row.itemId } });
      return;
    }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(row);
  };

  const navigateLists = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!tv || !event.key.startsWith("Arrow")) return;
    const active = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-favourite-row]") : null;
    if (!active) return;
    const col = Number(active.dataset['favouriteCol']);
    const row = Number(active.dataset['favouriteRow']);
    const action = active.dataset['favouriteAction'];
    let destination: HTMLElement | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      destination = root.current?.querySelector<HTMLElement>(`[data-favourite-col="${col}"][data-favourite-row="${row + (event.key === "ArrowDown" ? 1 : -1)}"][data-favourite-action="${action}"]`) ?? null;
    } else {
      const right = event.key === "ArrowRight";
      if (!home && ((right && action === "open") || (!right && action === "remove"))) {
        destination = root.current?.querySelector<HTMLElement>(`[data-favourite-col="${col}"][data-favourite-row="${row}"][data-favourite-action="${right ? "remove" : "open"}"]`) ?? null;
      } else {
        for (let next = col + (right ? 1 : -1); next >= 0 && next < GROUPS.length; next += right ? 1 : -1) {
          const items = Array.from(root.current?.querySelectorAll<HTMLElement>(`[data-favourite-col="${next}"][data-favourite-action="${home || right ? "open" : "remove"}"]`) ?? []);
          destination = items[Math.min(row, items.length - 1)] ?? null;
          if (destination) break;
        }
      }
    }
    if (destination) {
      event.preventDefault();
      event.stopPropagation();
      destination.focus({ preventScroll: true });
      destination.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  return (
    <div ref={root} onKeyDown={navigateLists} data-favourites-lists className="min-w-0">
      {favorites.isLoading ? <p role="status" className="py-3 text-sm text-muted-foreground">Loading favourites…</p> : (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
          {GROUPS.map((group, column) => {
            const items = rows.filter((row) => row.itemKind === group.kind);
            const Icon = group.icon;
            return (
              <section key={group.kind} aria-label={`Favourite ${group.title.toLowerCase()}`} className="min-w-0">
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border pb-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-base font-semibold"><Icon className="size-4 shrink-0 text-primary" /><span className="truncate">{home ? `Favourite ${group.title.toLowerCase()}` : group.title}</span></h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </header>
                <div className={home ? "scrollbar-thin mt-1 max-h-64 overflow-y-auto overscroll-contain p-1" : "mt-1 p-1"}>
                  {items.length === 0 && <p className="py-4 text-sm text-muted-foreground">No favourite {group.title.toLowerCase()} yet.</p>}
                  {items.map((row, index) => (
                    <div key={row.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border/50">
                      <FavouriteOpenButton row={row} column={column} index={index} onOpen={() => open(row)} onRemove={() => setRemoving(row)} className="h-12 min-w-0 justify-start gap-2 rounded px-2 text-left">
                        {row.logoUrl && <img src={row.logoUrl} alt="" loading="lazy" className={group.kind === "live" ? "size-8 shrink-0 object-contain" : "h-10 w-7 shrink-0 rounded-sm object-cover"} onError={(event) => { event.currentTarget.hidden = true; }} />}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                        {group.kind === "live" && <Play className="size-3 shrink-0 text-primary" />}
                      </FavouriteOpenButton>
                      {!home && <Button variant="ghost" size="icon" data-tv-focus data-favourite-col={column} data-favourite-row={index} data-favourite-action="remove" aria-label={`Remove ${row.title} from favourites`} title={`Remove ${row.title} from favourites`} disabled={toggle.isPending} onClick={() => toggle.mutate({ playlistId: row.playlistId, itemKind: row.itemKind, itemId: row.itemId, title: row.title, logoUrl: row.logoUrl })} className="size-9 shrink-0"><Star className="size-4 fill-primary text-primary" /></Button>}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <RemoveConfirmDialog
        title={removing?.title ?? null}
        mode="favourite"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          toggle.mutate({ playlistId: removing.playlistId, itemKind: removing.itemKind, itemId: removing.itemId, title: removing.title, logoUrl: removing.logoUrl });
          toast.success(`Removed ${removing.title} from favourites`);
        }}
      />
      <TitleDetailsDialog kind={selected?.itemKind === "series" ? "series" : "movie"} id={selected?.itemId ?? null} name={selected?.title} image={selected?.logoUrl} variants={variants} onClose={() => setSelected(null)} onCloseAutoFocus={(event) => {
        event.preventDefault();
        window.requestAnimationFrame(() => {
          if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
          else root.current?.querySelector<HTMLElement>('[data-favourite-action="open"]')?.focus();
        });
      }} />
    </div>
  );
}
