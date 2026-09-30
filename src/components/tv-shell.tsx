import { Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Home, MonitorPlay, Star, Tv } from "lucide-react";
import type { ReactNode } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { useSpatialNav } from "@/lib/use-spatial-nav";

const TV_NAV = [
  { to: "/tv", label: "Home", icon: Home },
  { to: "/tv/live", label: "Live TV", icon: Tv },
  { to: "/tv/movies", label: "Movies", icon: Clapperboard },
  { to: "/tv/series", label: "Series", icon: MonitorPlay },
  { to: "/tv/favorites", label: "Favourites", icon: Star },
] as const;

export function TvShell({
  title,
  children,
  immersive = false,
}: {
  title: string;
  children: ReactNode;
  immersive?: boolean;
}) {
  const { active } = usePlaylists();
  const navigate = useNavigate();
  useSpatialNav({ onBack: () => void navigate({ to: "/tv" }) });

  return (
    <div
      className={
        immersive
          ? "flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground"
          : "min-h-screen bg-background text-foreground"
      }
    >
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded bg-primary text-primary-foreground sm:size-10">
          <Tv className="size-5" />
        </span>
        <nav className="scrollbar-thin flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
          {TV_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              data-tv-focus
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground outline-none transition focus:bg-primary focus:text-primary-foreground focus:ring-4 focus:ring-primary/40 sm:px-4 sm:text-lg"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: to === "/tv" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 text-right md:block">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Source</p>
          <p className="text-lg font-semibold">{active?.name ?? "No playlist"}</p>
        </div>
      </header>

      <main className={immersive ? "min-h-0 flex-1 overflow-hidden px-3 py-2 sm:px-6 sm:py-3" : "px-8 py-6"}>
        <h1 className={immersive ? "sr-only" : "mb-5 font-display text-4xl font-bold tracking-tight"}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function TvTile({
  title,
  subtitle,
  image,
  progress,
  onSelect,
}: {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  progress?: number | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-tv-focus
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left outline-none transition focus:scale-[1.03] focus:border-primary focus:ring-4 focus:ring-primary/40"
    >
      <div className="relative aspect-[2/3] w-full bg-muted">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="size-full object-cover"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="grid size-full place-items-center px-2 text-center text-sm text-muted-foreground">
            {title}
          </span>
        )}
        {typeof progress === "number" && progress > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <span
              className="block h-full bg-primary"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-base font-semibold">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </button>
  );
}

export function TvGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-6">{children}</div>
  );
}
