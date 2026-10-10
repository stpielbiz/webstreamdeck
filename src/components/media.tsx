import { Link } from "@tanstack/react-router";
import { ExternalLink, Play, Star } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Poster tiles link to several typed routes; a loose wrapper keeps the props generic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnyLink = Link as any;

export function PosterTile({
  to,
  params,
  search,
  title,
  image,
  subtitle,
  progress,
  external,
  favorite,
  onToggleFavorite,
  onSelect,
  zoneEntry,
}: {
  to?: string;
  params?: Record<string, string> | undefined;
  search?: Record<string, unknown> | undefined;
  title: string;
  image: string | null | undefined;
  subtitle?: string | null | undefined;
  progress?: number | null | undefined;
  /** Show a badge instead of a progress bar when watched in an external player. */
  external?: boolean | undefined;
  favorite?: boolean | undefined;
  onToggleFavorite?: (() => void) | undefined;
  onSelect?: (() => void) | undefined;
  zoneEntry?: boolean | undefined;
}) {
  const artwork = (
    <>
      <div className="relative aspect-[2/3] w-full bg-muted">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">
            {title}
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
          <Play className="size-8 text-primary" />
        </div>
        {external ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white">
            <ExternalLink className="size-3 text-primary" /> External player
          </span>
        ) : typeof progress === "number" && progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="px-2 py-2">
        <p className="truncate text-xs font-medium">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </>
  );

  return (
    <div className="group relative">
      {onSelect ? (
        <button type="button" data-tv-focus data-zone-entry={zoneEntry ? "true" : undefined} onClick={onSelect} className="block w-full overflow-hidden rounded-lg border border-border bg-card text-left outline-none transition hover:border-primary/60 focus-visible:tile-focus">
          {artwork}
        </button>
      ) : (
        <AnyLink to={to} params={params} search={search} className="block overflow-hidden rounded-lg border border-border bg-card transition focus-visible:tile-focus hover:border-primary/60">
          {artwork}
        </AnyLink>
      )}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? "Remove from favourites" : "Add to favourites"}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Star
            className={cn("size-4", favorite ? "fill-primary text-primary" : "text-white")}
          />
        </button>
      )}
    </div>
  );
}

export function Shelf({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PosterGrid({ children }: { children: ReactNode }) {
  return (
    <div data-tv-poster-grid className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
