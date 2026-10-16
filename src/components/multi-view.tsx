import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import type { CatalogItem } from "@/lib/iptv-types";
import { useGetItems, useGetPlayback } from "@/lib/device-provider";
import { hasNativePlayer } from "@/lib/external-player";
import { isFavorite, useFavorites } from "@/lib/library-hooks";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/search-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Screen {
  item: CatalogItem;
  url: string | null;
  directUrl: string | null;
}

/**
 * Multi-view: choose up to four channels and watch them together. The Fire TV
 * app plays them in its native grid; browsers show an in-page grid where only
 * the selected screen has sound. The picker lists favourites and recents first
 * and can search the whole playlist, so channels from different categories can
 * be combined.
 */
export function MultiView({
  open,
  playlistId,
  candidates,
  initial,
  onClose,
}: {
  open: boolean;
  playlistId: string | null;
  candidates: CatalogItem[];
  initial: CatalogItem | null;
  onClose: () => void;
}) {
  const resolve = useGetPlayback();
  const fetchItems = useGetItems();
  const favorites = useFavorites();
  const [picked, setPicked] = useState<CatalogItem[]>([]);
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CatalogItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setPicked(initial ? [initial] : []);
      setTerm("");
      setResults(null);
    }
  }, [open, initial]);

  useEffect(() => {
    const query = term.trim();
    if (!open || !playlistId || !query) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetchItems({ data: { playlistId, kind: "live", search: query } })
      .then((items) => {
        if (!cancelled) setResults(items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, playlistId, term, fetchItems]);

  const toggle = (item: CatalogItem) =>
    setPicked((list) =>
      list.some((row) => row.id === item.id)
        ? list.filter((row) => row.id !== item.id)
        : list.length >= 4
          ? (toast.message("Multi-view shows up to 4 channels"), list)
          : [...list, item],
    );

  const start = async () => {
    if (!playlistId || picked.length < 2) return;
    setStarting(true);
    try {
      const resolved = await Promise.all(
        picked.map(async (item) => {
          const result = await resolve({ data: { playlistId, kind: "live", itemId: item.id } });
          return { item, url: result.url, directUrl: result.directUrl };
        }),
      );
      if (hasNativePlayer() && window.StreamDeckNative?.playMulti) {
        window.StreamDeckNative.playMulti(
          JSON.stringify(resolved.map((s) => ({ url: s.directUrl ?? s.url, title: s.item.name }))),
        );
        onClose();
      } else {
        setScreens(resolved);
      }
    } catch (error) {
      toast.error(`Couldn't start Multi-view: ${(error as Error).message}`);
    } finally {
      setStarting(false);
    }
  };

  // Without a search term: favourites of this playlist first, then the
  // recent/category candidates the pages pass in. With a term: the search
  // matches from the whole playlist.
  const browsing = term.trim().length > 0;
  const unique = browsing
    ? (results ?? [])
    : [
        ...new Map(
          [
            ...(initial ? [initial] : []),
            ...candidates.filter((item) => playlistId && isFavorite(favorites.data, playlistId, "live", item.id)),
            ...candidates,
          ].map((item) => [item.id, item]),
        ).values(),
      ].slice(0, 60);

  if (screens) return <MultiViewGrid screens={screens} onClose={() => { setScreens(null); onClose(); }} />;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Multi-view</DialogTitle>
        <DialogDescription>
          Pick 2 to 4 channels to watch together. Each screen uses one connection from your provider, so some plans may refuse extra screens.
        </DialogDescription>
        <div data-remote-row>
          <SearchField
            value={term}
            onValueChange={setTerm}
            placeholder="Search all channels…"
            aria-label="Search channels for Multi-view"
            data-tv-focus
            data-focus-key="multiview-search"
          />
        </div>
        <div className="scrollbar-thin max-h-[50vh] space-y-1 overflow-y-auto p-1">
          {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
          {!searching && unique.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {browsing ? "No channels match that search." : "Watch or favourite a few channels first and they'll appear here."}
            </p>
          )}
          {unique.map((item) => {
            const on = picked.some((row) => row.id === item.id);
            return (
              <div key={item.id} data-remote-row>
                <Button data-tv-focus variant={on ? "default" : "ghost"} className="h-10 w-full justify-between" onClick={() => toggle(item)}>
                  <span className="truncate">{item.name}</span>
                  {on && <Check className="size-4" />}
                </Button>
              </div>
            );
          })}
        </div>
        <div data-remote-row className="flex justify-end gap-2">
          <Button data-dialog-back data-tv-focus variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-tv-focus disabled={picked.length < 2 || starting} onClick={() => void start()}>
            {starting ? "Starting…" : `Watch ${picked.length} screens`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MultiViewGrid({ screens, onClose }: { screens: Screen[]; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current.forEach((element, index) => {
      element?.querySelectorAll("video").forEach((video) => { video.muted = index !== active; });
    });
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "Escape" || key === "Backspace" || key === "GoBack" || key === "BrowserBack") {
        event.preventDefault();
        event.stopPropagation();
        if (enlarged) setEnlarged(false);
        else onClose();
        return;
      }
      if (enlarged) return;
      let next = active;
      if (key === "ArrowLeft" && active % 2 === 1) next = active - 1;
      if (key === "ArrowRight" && active % 2 === 0 && active + 1 < screens.length) next = active + 1;
      if (key === "ArrowUp" && active >= 2) next = active - 2;
      if (key === "ArrowDown" && active + 2 < screens.length) next = active + 2;
      if (key === "Enter") { event.preventDefault(); setEnlarged(true); return; }
      if (next !== active) { event.preventDefault(); event.stopPropagation(); setActive(next); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, enlarged, screens.length, onClose]);

  return (
    <div role="dialog" aria-label="Multi-view" className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
        <span>Arrows choose a screen (it gets the sound) · OK enlarges · Back returns</span>
        <Button data-dialog-back variant="ghost" size="icon" aria-label="Close Multi-view" onClick={onClose}><X className="size-5" /></Button>
      </div>
      <div className={cn("grid min-h-0 flex-1 gap-1 p-1", !enlarged && "grid-cols-2", !enlarged && screens.length > 2 && "grid-rows-2")}>
        {screens.map((screen, index) => (
          <div
            key={screen.item.id}
            ref={(element) => { refs.current[index] = element; }}
            onClick={() => setActive(index)}
            className={cn(
              "relative min-h-0 overflow-hidden rounded border-4",
              index === active ? "border-primary" : "border-transparent",
              enlarged && index !== active && "hidden",
            )}
          >
            <VideoPlayer allowNative={false} src={screen.url} fallbackSrc={screen.directUrl} title={screen.item.name} poster={screen.item.image} live className="h-full w-full" />
            <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs">{screen.item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
