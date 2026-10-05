import { Link } from "@tanstack/react-router";
import { CalendarClock, Clapperboard, Download, Home, ListVideo, MonitorPlay, ShieldCheck, Star, Tv } from "lucide-react";
import { useIsAdmin } from "@/lib/use-admin";
import { useEffect, useRef, type FocusEvent } from "react";

import { Button } from "@/components/ui/button";

export type BrowseLayer = "sections" | "categories" | "content";

const SECTIONS = [
  { to: "/dashboard", tvTo: "/tv", label: "Home", icon: Home },
  { to: "/guide", tvTo: "/tv/guide", label: "Guide", icon: CalendarClock },
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
}: {
  tv?: boolean;
  current?: string;
  focused?: string;
  onFocusItem?: (label: string) => void;
  compact?: boolean;
  zoneOrder?: number;
}) {
  const { isAdmin } = useIsAdmin();
  const extras = [
    { to: "/playlists" as const, label: "Playlists", icon: ListVideo },
    { to: "/download" as const, label: "Get the TV app", icon: Download },
    ...(isAdmin ? [{ to: "/admin" as const, label: "Admin", icon: ShieldCheck }] : []),
  ];
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    const item = event.target.closest<HTMLElement>("[data-section-label]");
    const label = item?.dataset['sectionLabel'];
    if (label) onFocusItem?.(label);
  };
  return (
    <section
      data-tv-zone="sections"
      data-tv-zone-order={zoneOrder}
      onFocus={handleFocus}
      className={compact
        ? "scrollbar-thin h-full min-h-0 w-full overflow-y-auto overscroll-contain py-2"
        : "mx-auto h-full w-full max-w-3xl animate-slide-in-right overflow-y-auto py-3 motion-reduce:animate-none"}
    >
      <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">Browse</p>
      <div className="flex flex-col gap-1">
        {SECTIONS.map(({ to, tvTo, label, icon: Icon }) => {
          const destination = tv ? tvTo : to;
          return (
            <Button key={label} asChild variant={focused === label || (!focused && current === label) ? "default" : "ghost"} className={compact ? "h-11 justify-start px-3 text-base" : "h-14 justify-start px-4 text-lg"}>
            <Link to={destination} data-tv-focus data-section-label={label} data-focus-key={`section-${label}`}>
                <Icon className="size-5 shrink-0" /> {label}
              </Link>
            </Button>
          );
        })}
        {extras.map(({ to, label, icon: Icon }) => (
          <Button key={label} asChild variant={focused === label || (!focused && current === label) ? "default" : "ghost"} className={compact ? "h-11 justify-start px-3 text-base" : "h-14 justify-start px-4 text-lg"}>
            <Link to={to} search={tv ? { mode: "tv" } : {}} data-tv-focus data-section-label={label} data-focus-key={`section-${label}`}>
              <Icon className="size-5 shrink-0" /> {label}
            </Link>
          </Button>
        ))}
      </div>
    </section>
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