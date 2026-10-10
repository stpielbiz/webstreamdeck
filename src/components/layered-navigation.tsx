import { Link } from "@tanstack/react-router";
import { Clapperboard, Download, Home, Layers, ListVideo, Loader2, MonitorPlay, RefreshCw, Settings, ShieldCheck, Star, Tv } from "lucide-react";
import { useIsAdmin } from "@/lib/use-admin";
import { useEffect, useRef, useState, type FocusEvent } from "react";

import { Button } from "@/components/ui/button";
import { useSavedFranchises } from "@/lib/saved-franchises";

export type BrowseLayer = "sections" | "categories" | "content";

const SECTIONS = [
  { to: "/dashboard", tvTo: "/tv", label: "Home", icon: Home },
  { to: "/live", tvTo: "/tv/live", label: "Live TV", icon: Tv },
  { to: "/movies", tvTo: "/tv/movies", label: "Movies", icon: Clapperboard },
  { to: "/series", tvTo: "/tv/series", label: "Shows", icon: MonitorPlay },
  { to: "/favorites", tvTo: "/tv/favorites", label: "Favourites", icon: Star },
] as const;

export function useLayerFocus(layer: BrowseLayer, key?: string | null) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferred = previous.current
        ? document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(previous.current)}"]`)
        : null;
      const first = document.querySelector<HTMLElement>(`[data-tv-zone="${layer}"] [data-tv-focus]:not([disabled])`);
      (preferred ?? first)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layer, key]);
  return (focusKey: string) => {
    previous.current = focusKey;
  };
}

export function SectionMenu({
  tv,
  current,
  focused,
  onFocusItem,
  compact = false,
  zoneOrder,
  onCheckUpdates,
}: {
  tv?: boolean;
  current?: string;
  focused?: string;
  onFocusItem?: (label: string) => void;
  compact?: boolean;
  zoneOrder?: number;
  onCheckUpdates?: () => void;
}) {
  const { isAdmin } = useIsAdmin();
  const savedFranchises = useSavedFranchises();
  const [opening, setOpening] = useState<string | null>(null);
  const extras = [
    { to: "/playlists" as const, label: "Playlists", icon: ListVideo },
    { to: "/settings" as const, label: "Settings", icon: Settings },
    { to: "/download" as const, label: "Get the TV app", icon: Download },
    ...(isAdmin ? [{ to: "/admin" as const, label: "Admin", icon: ShieldCheck }] : []),
  ];
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    const item = event.target.closest<HTMLElement>("[data-section-label]");
    const label = item?.dataset['sectionLabel'];
    if (label) onFocusItem?.(label);
  };
  return (
    <>
      <section
      data-tv-section-menu
      data-tv-zone="sections"
      data-tv-zone-order={zoneOrder}
      onFocus={handleFocus}
      className={compact
        ? "scrollbar-thin h-full min-h-0 w-full overflow-y-auto overscroll-contain p-1"
        : "mx-auto h-full w-full max-w-3xl animate-slide-in-right overflow-y-auto py-3 motion-reduce:animate-none"}
    >
      <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">Browse</p>
      <div className="flex flex-col gap-1">
        {[...SECTIONS, ...(savedFranchises.data?.length ? [{ to: "/franchises" as const, tvTo: "/tv/franchises" as const, label: "Franchise", icon: Layers }] : [])].map(({ to, tvTo, label, icon: Icon }) => {
          const destination = tv ? tvTo : to;
          return (
            <Button key={label} asChild variant={focused === label || (!focused && current === label) ? "default" : "ghost"} className={compact ? "h-11 justify-start px-3 text-base" : "h-14 justify-start px-4 text-lg"}>
            <Link to={destination} preload={tv ? false : "intent"} onClick={() => setOpening(label)} data-tv-focus data-section-label={label} data-focus-key={`section-${label}`}>
                <Icon className="size-5 shrink-0" /> {label}
              </Link>
            </Button>
          );
        })}
        {extras.map(({ to, label, icon: Icon }) => (
          <Button key={label} asChild variant={focused === label || (!focused && current === label) ? "default" : "ghost"} className={compact ? "h-11 justify-start px-3 text-base" : "h-14 justify-start px-4 text-lg"}>
            <Link to={to} search={tv ? { mode: "tv" } : {}} preload={tv ? false : "intent"} onClick={() => setOpening(label)} data-tv-focus data-section-label={label} data-focus-key={`section-${label}`}>
              <Icon className="size-5 shrink-0" /> {label}
            </Link>
          </Button>
        ))}
        {onCheckUpdates && (
          <Button type="button" variant="ghost" onClick={onCheckUpdates} data-tv-focus data-focus-key="check-for-updates" className={compact ? "mt-3 h-11 justify-start border-t border-border px-3 text-base" : "mt-3 h-14 justify-start border-t border-border px-4 text-lg"}>
            <RefreshCw className="size-5 shrink-0" /> Check for updates
          </Button>
        )}
      </div>
      </section>
      {opening && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[100] grid place-items-center bg-background/85 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded border border-border bg-card px-5 py-4 shadow-lg">
            <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" />
            <span className="font-display text-lg font-semibold">Opening {opening}…</span>
          </div>
        </div>
      )}
    </>
  );
}

export function LayerHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}