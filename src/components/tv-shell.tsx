import { useNavigate } from "@tanstack/react-router";
import { Tv } from "lucide-react";
import type { ReactNode } from "react";

import { usePlaylists } from "@/components/playlist-context";
import { useSpatialNav } from "@/lib/use-spatial-nav";

export function TvShell({
  title,
  children,
  immersive = false,
  onBack,
}: {
  title: string;
  children: ReactNode;
  immersive?: boolean;
  onBack?: (() => void) | undefined;
}) {
  const { active } = usePlaylists();
  const navigate = useNavigate();
  useSpatialNav({
    onBack:
      onBack ??
      (() => {
         const dialogBack = document.querySelector<HTMLElement>("[data-dialog-back]");
         if (dialogBack) {
           dialogBack.click();
           return;
         }
        const layerBack = document.querySelector<HTMLElement>("[data-layer-back]");
        if (layerBack) layerBack.click();
        else void navigate({ to: "/tv" });
      }),
  });

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
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">Stream Deck</p>
          <p className="truncate text-xs text-muted-foreground">{title}</p>
        </div>
        <div className="hidden shrink-0 text-right md:block">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Source</p>
          <p className="text-lg font-semibold">{active?.name ?? "No playlist"}</p>
        </div>
      </header>

      <main className={immersive ? "min-h-0 flex-1 overflow-hidden px-3 py-2 sm:px-6 sm:py-3" : "px-3 py-3 sm:px-6 sm:py-4"}>
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
      className="group w-full overflow-hidden rounded-lg border border-border bg-card text-left outline-none transition focus:scale-[1.02] focus:border-primary focus:ring-4 focus:ring-primary/40"
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
      <div className="p-2">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </button>
  );
}

export function TvGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">{children}</div>
  );
}
