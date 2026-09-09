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

export function TvShell({ title, children }: { title: string; children: ReactNode }) {
  const { active } = usePlaylists();
  const navigate = useNavigate();
  useSpatialNav({ onBack: () => void navigate({ to: "/tv" }) });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-8 py-5">
        <span className="mr-4 grid size-10 place-items-center rounded bg-primary text-primary-foreground">
          <Tv className="size-5" />
        </span>
        <nav className="flex flex-wrap items-center gap-2">
          {TV_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              data-tv-focus
              className="flex items-center gap-2 rounded-lg px-5 py-3 text-xl font-semibold text-muted-foreground outline-none transition focus:bg-primary focus:text-primary-foreground focus:ring-4 focus:ring-primary/40"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: to === "/tv" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Source</p>
          <p className="text-lg font-semibold">{active?.name ?? "No playlist"}</p>
        </div>
      </header>

      <main className="px-8 py-6">
        <h1 className="mb-5 font-display text-4xl font-bold tracking-tight">{title}</h1>
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
