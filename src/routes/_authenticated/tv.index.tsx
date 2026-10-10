import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Download, ListVideo, MonitorPlay, Settings, ShieldCheck, Star, Tv } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CatalogItem } from "@/lib/iptv-types";
import { syncedResumeRows, useSyncPlaylists } from "@/lib/playlist-sync";
import { useEffect, useMemo, useRef, useState } from "react";
import { TitleDetailsDialog } from "@/components/title-details-dialog";
import { toast } from "sonner";

import { TvShell } from "@/components/tv-shell";
import { GlobalSearch } from "@/components/global-search";
import { usePlaylists } from "@/components/playlist-context";
import { useFavorites, useProgress } from "@/lib/library-hooks";
import { SectionMenu } from "@/components/layered-navigation";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/use-admin";
import { useLibraryOverview, useBulkRefreshState, runBulkRefresh, stopBulkRefresh, type LibrarySectionStatus } from "@/lib/library-sync";
import { adminRefreshTitles } from "@/lib/metadata.functions";
import { useServerFn } from "@tanstack/react-start";
import { variantsForItem } from "@/lib/title-variants";

export const Route = createFileRoute("/_authenticated/tv/")({
  head: () => ({
    meta: [
      { title: "TV mode — Stream Deck" },
      {
        name: "description",
        content: "Big-screen TV mode: carry on watching, jump into live TV, movies and series.",
      },
      { property: "og:title", content: "TV mode — Stream Deck" },
      { property: "og:description", content: "Remote-friendly big screen view of your playlists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvHome,
});

function TvHome() {
  const navigate = useNavigate();
  const { activeId, sync } = usePlaylists();
  const library = useLibraryOverview(activeId);
  const { data: progress } = useProgress();
  const { data: favorites } = useFavorites();
  const { isAdmin } = useIsAdmin();
  const [focusedSection, setFocusedSection] = useState("Home");
  const checkForUpdates = () => {
    const native = window.StreamDeckNative;
    if (typeof native?.checkForUpdates === "function") {
      native.checkForUpdates();
      return;
    }
    toast.info(native ? "Install the latest TV app to enable manual update checks." : "The website updates automatically. Update checks are available in the Fire TV app.", {
      action: { label: "Get the TV app", onClick: () => void navigate({ to: "/download", search: { mode: "tv" } }) },
    });
  };

  const syncPlaylists = useSyncPlaylists();
  const queryClient = useQueryClient();
  const movieItems = queryClient.getQueryData<CatalogItem[]>(["system-catalogue", activeId, "movie"]);
  const showItems = queryClient.getQueryData<CatalogItem[]>(["system-catalogue", activeId, "series"]);
  const resume = useMemo(() => syncedResumeRows(
    progress, activeId, syncPlaylists,
    movieItems, showItems,
  ).filter((row) => !row.completed && row.positionSeconds > 30), [progress, activeId, syncPlaylists, movieItems, showItems]);
  const favouriteChannels = (favorites ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind === "live",
  );
  const favouriteTitles = (favorites ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind !== "live",
  );
  const [openFavourite, setOpenFavourite] = useState<(typeof favouriteTitles)[number] | null>(null);
  const favouriteVariants = openFavourite && activeId && (openFavourite.itemKind === "movie" || openFavourite.itemKind === "series")
    ? variantsForItem(queryClient.getQueryData<CatalogItem[]>(["system-catalogue", activeId, openFavourite.itemKind]) ?? [], openFavourite.itemId)
    : [];
  const favouriteTrigger = useRef<HTMLElement | null>(null);
  const openTitle = (row: (typeof favouriteTitles)[number]) => {
    favouriteTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenFavourite(row);
  };


  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-focus-key="section-Home"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const returnToMenu = () => {
    const activeZone = document.activeElement?.closest<HTMLElement>("[data-tv-zone]")?.dataset['tvZone'];
    if (activeZone === "home-content") {
      document.querySelector<HTMLElement>(`[data-focus-key="section-${CSS.escape(focusedSection)}"]`)?.focus();
    }
  };

  return (
    <TvShell title="Home" immersive onBack={returnToMenu}>
      <div data-tv-zone-group="tv-home" className="grid h-full min-h-0 grid-cols-[minmax(12rem,22%)_minmax(0,1fr)] gap-4 lg:gap-6">
        <aside className="min-h-0 border-r border-border pr-3 lg:pr-5">
          <SectionMenu tv current="Home" focused={focusedSection} onFocusItem={setFocusedSection} compact zoneOrder={1} onCheckUpdates={checkForUpdates} />
        </aside>
        <main data-tv-zone="home-content" data-tv-zone-order="2" data-horizontal-nav="true" className="scrollbar-thin min-h-0 overflow-y-auto overscroll-contain pr-2">
          {focusedSection === "Home" ? (
            <div className="space-y-5 pb-6">
              {activeId && <div className="sticky top-0 z-20 bg-background pb-3"><GlobalSearch /></div>}
              <div className="pb-1">
                <p className="text-xs font-semibold uppercase text-primary">Your library</p>
                <h2 className="font-display text-2xl font-bold">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick up where you stopped or jump into a favourite.</p>
              </div>
              {!activeId && <HomeMessage title="No playlist yet" body="Add a playlist to see your channels, movies and shows here." to="/playlists" action="Add playlist" />}
              {sync.running && <p role="status" className="text-xs text-muted-foreground">{sync.total ? `Preparing your library… TV guide ${sync.done}/${sync.total} channels` : "Preparing your library…"}</p>}
              <HomeShelf title="Continue watching" empty="Nothing to resume yet.">
                {resume.slice(0, 20).map((row, index) => (
                  <HomeTile
                    key={`${row.itemKind}-${row.itemId}`}
                    kind="continue"
                    title={row.title}
                    image={row.posterUrl}
                    subtitle={row.external ? "External player" : row.itemKind === "episode" ? `S${row.season} E${row.episode}` : row.durationSeconds ? `${Math.max(1, Math.round((row.durationSeconds - row.positionSeconds) / 60))} min left` : null}
                    progress={row.external ? null : row.durationSeconds ? row.positionSeconds / row.durationSeconds : null}
                    zoneEntry={index === 0}
                    edgeLeft={index === 0}
                    onSelect={() => void navigate(row.itemKind === "episode" && row.seriesId ? { to: "/tv/watch/series/$id", params: { id: row.seriesId }, search: { from: "home" } } : { to: "/tv/watch/movie/$id", params: { id: row.itemId }, search: { from: "home" } })}
                  />
                ))}
              </HomeShelf>
              <HomeShelf title="Favourite channels" empty="Star channels to keep them close.">
                {favouriteChannels.slice(0, 20).map((row, index) => (
                  <HomeTile key={row.id} kind="channel" title={row.title} image={row.logoUrl} zoneEntry={resume.length === 0 && index === 0} edgeLeft={index === 0} onSelect={() => void navigate({ to: "/tv/live", search: { channel: row.itemId } })} />
                ))}
              </HomeShelf>
              <HomeShelf title="Favourite movies and shows" empty="Star a movie or show to find it here.">
                {favouriteTitles.slice(0, 20).map((row, index) => (
                  <HomeTile key={row.id} kind="poster" title={row.title} image={row.logoUrl} zoneEntry={resume.length === 0 && favouriteChannels.length === 0 && index === 0} edgeLeft={index === 0} onSelect={() => openTitle(row)} />
                ))}
              </HomeShelf>
            </div>
          ) : (
            <SectionPreview section={focusedSection} resumeCount={resume.length} favouriteCount={favouriteChannels.length + favouriteTitles.length} isAdmin={isAdmin} library={library} hasPlaylist={!!activeId} sync={sync} />
          )}
        </main>
      </div>
      <TitleDetailsDialog
        kind={openFavourite?.itemKind === "series" ? "series" : "movie"}
        id={openFavourite?.itemId ?? null}
        name={openFavourite?.title}
        image={openFavourite?.logoUrl}
        variants={favouriteVariants}
        onClose={() => setOpenFavourite(null)}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const trigger = favouriteTrigger.current;
          window.requestAnimationFrame(() => {
            if (trigger?.isConnected) trigger.focus({ preventScroll: true });
            else document.querySelector<HTMLElement>('[data-tv-zone="home-content"] [data-tv-focus]')?.focus();
          });
        }}
      />
    </TvShell>
  );
}

function HomeShelf({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <h3 className="mb-2 font-display text-lg font-semibold">{title}</h3>
      {hasItems ? <div data-remote-row className="scrollbar-thin flex gap-3 overflow-x-auto overflow-y-hidden p-1 pb-3">{children}</div> : <p className="rounded border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function HomeTile({
  kind,
  title,
  subtitle,
  image,
  progress,
  onSelect,
  zoneEntry,
  edgeLeft,
}: {
  kind: "continue" | "channel" | "poster";
  title: string;
  subtitle?: string | null;
  image?: string | null;
  progress?: number | null;
  onSelect: () => void;
  zoneEntry?: boolean;
  edgeLeft?: boolean;
}) {
  const shellClass = kind === "continue" ? "w-48" : kind === "channel" ? "w-28" : "w-28";
  const imageClass = kind === "continue" ? "aspect-video" : kind === "channel" ? "aspect-square" : "aspect-[2/3]";
  return (
    <Button
      data-tv-home-tile={kind}
      type="button"
      variant="ghost"
      data-tv-focus
      data-zone-entry={zoneEntry ? "true" : undefined}
      data-zone-edge-left={edgeLeft ? "true" : undefined}
      onClick={onSelect}
      className={`group h-auto shrink-0 flex-col items-stretch justify-start overflow-hidden rounded p-0 text-left outline-none transition focus:scale-[1.025] focus:ring-2 focus:ring-primary motion-reduce:transform-none ${shellClass}`}
    >
      <span className={`relative block w-full overflow-hidden rounded border border-border bg-muted ${imageClass}`}>
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className={`size-full ${kind === "channel" ? "object-contain p-3" : "object-cover"}`}
            onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
          />
        ) : (
          <span className="grid size-full place-items-center px-2 text-center text-xs text-muted-foreground">{title}</span>
        )}
        {typeof progress === "number" && progress > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
            <span className="block h-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="block min-w-0 px-1 pb-1 pt-2">
        <span className="block truncate text-xs font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{subtitle}</span>}
      </span>
    </Button>
  );
}

const PREVIEWS = {
  "Live TV": { icon: Tv, title: "Live TV", body: "Browse categories and move across the programme guide to see what is coming up.", to: "/tv/live", action: "Open Live TV" },
  Movies: { icon: Clapperboard, title: "Movies", body: "Browse your movie library by system category, year, or title.", to: "/tv/movies", action: "Browse movies" },
  Shows: { icon: MonitorPlay, title: "Shows", body: "Find series, seasons, and episodes from your playlist.", to: "/tv/series", action: "Browse shows" },
  Favourites: { icon: Star, title: "Favourites", body: "Your saved channels, movies, and shows in one place.", to: "/tv/favorites", action: "Open favourites" },
  Settings: { icon: Settings, title: "Settings", body: "Sync my playlists and other preferences.", to: "/settings", action: "Open settings" },
  Playlists: { icon: ListVideo, title: "Playlists", body: "Add or switch the IPTV source used by Stream Deck.", to: "/playlists", action: "Manage playlists" },
  "Get the TV app": { icon: Download, title: "Get the TV app", body: "Download the latest Stream Deck app for Fire TV.", to: "/download", action: "Open download page" },
  Admin: { icon: ShieldCheck, title: "Admin", body: "Manage organisation tools and connection logs.", to: "/admin", action: "Open admin" },
} as const;

function SectionPreview({ section, resumeCount, favouriteCount, isAdmin, library, hasPlaylist, sync }: { section: string; resumeCount: number; favouriteCount: number; isAdmin: boolean; library: ReturnType<typeof useLibraryOverview>; hasPlaylist: boolean; sync: { running: boolean; done: number; total: number } }) {
  const preview = PREVIEWS[section as keyof typeof PREVIEWS];
  if (!preview || (section === "Admin" && !isAdmin)) return null;
  const Icon = preview.icon;
  return (
    <div className="py-1">
      <section className="w-full max-w-3xl">
        <div data-remote-row className="sticky top-0 z-20 flex flex-wrap gap-2 bg-background pb-2">        <Button asChild size="lg" className="mb-5">
          <Link to={preview.to} search={section === "Playlists" || section === "Settings" || section === "Get the TV app" || section === "Admin" ? { mode: "tv" } : {}} preload={false} data-tv-focus data-zone-entry="true">{preview.action}</Link>
        </Button>
{section === "Movies" && isAdmin && <BulkRefresh kind="movie" />}{section === "Shows" && isAdmin && <BulkRefresh kind="series" />}</div>
        <Icon className="size-10 text-primary" />
        <p className="mt-5 text-xs font-semibold uppercase text-primary">Focused section</p>
        <h2 className="mt-1 font-display text-4xl font-bold">{preview.title}</h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{preview.body}</p>
        {section === "Live TV" && <LibraryStatus status={library.live} kind="live" hasPlaylist={hasPlaylist} syncing={sync.running} />}
        {section === "Movies" && <LibraryStatus status={library.movie} kind="movie" hasPlaylist={hasPlaylist} isAdmin={isAdmin} />}
        {section === "Shows" && <LibraryStatus status={library.series} kind="series" hasPlaylist={hasPlaylist} isAdmin={isAdmin} />}
        {section === "Favourites" && (
          <p className="mt-4 text-sm text-muted-foreground">{resumeCount} waiting to resume · {favouriteCount} favourites</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">Press OK on the menu to open, or press Right to use this button.</p>
      </section>
    </div>
  );
}

function LibraryStatus({ status, kind, hasPlaylist, syncing = false, isAdmin = false }: { status: LibrarySectionStatus; kind: "live" | "movie" | "series"; hasPlaylist: boolean; syncing?: boolean; isAdmin?: boolean }) {
  if (!hasPlaylist) return <p className="mt-5 text-sm text-muted-foreground">Add a playlist to see library status.</p>;
  if (!status.loaded) return <p className="mt-5 text-sm text-muted-foreground">Preparing saved library…</p>;
  const label = kind === "live" ? "TV guide" : "Title details";
  const noun = kind === "live" ? "channels" : kind === "movie" ? "movies" : "shows";
  const lastUpdated = status.updatedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(status.updatedAt) : "Not updated yet";
  return (
    <div className="mt-6 max-w-2xl border-y border-border py-5" aria-live="polite">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Saved library</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{status.total.toLocaleString()} <span className="text-base font-medium text-muted-foreground">{noun}</span></p>
        </div>
        <p className="text-right text-sm font-semibold tabular-nums text-primary">{status.percent}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded bg-muted" role="progressbar" aria-label={`${label} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent}>
        <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${status.percent}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <p>{syncing ? "Updating TV guide… " : ""}{label}: {status.updated.toLocaleString()} of {status.total.toLocaleString()}</p>
        <p>Last updated: {lastUpdated}</p>
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {kind === "live" ? (
          <li>{status.withOverview.toLocaleString()} of {status.total.toLocaleString()} channels have programme descriptions in the TV guide.</li>
        ) : (
          <>
            <li>{status.updated.toLocaleString()} of {status.total.toLocaleString()} {noun} matched with the movie database (category, year, artwork).</li>
            <li>{status.withOverview.toLocaleString()} have a full description · {status.withCast.toLocaleString()} have actors.</li>
          </>
        )}
      </ul>
      {kind !== "live" && status.topGenres.length > 0 && (
        <p className="mt-4 text-sm"><span className="text-muted-foreground">Top genres:</span> {status.topGenres.join(" · ")}</p>
      )}
    </div>
  );
}

function BulkRefresh({ kind }: { kind: "movie" | "series" }) {
  const state = useBulkRefreshState();
  const client = useQueryClient();
  const refresh = useServerFn(adminRefreshTitles);
  const { activeId } = usePlaylists();
  const mine = state.kind === kind;
  const percent = state.total ? Math.round((state.done / state.total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state.running ? (
        <Button variant="secondary" size="sm" data-tv-focus onClick={stopBulkRefresh}>Stop details update</Button>
      ) : (
        <Button variant="secondary" size="sm" data-tv-focus disabled={!activeId} onClick={() => activeId && void runBulkRefresh(client, activeId, kind, refresh)}>Update all details now (admin)</Button>
      )}
      {state.running && (
        <p className="text-sm text-muted-foreground tabular-nums">
          {mine ? `Updating ${state.done.toLocaleString()} of ${state.total.toLocaleString()} (${percent}%)` : `Updating ${state.kind === "movie" ? "movies" : "shows"}…`}
          {state.failed ? ` · ${state.failed.toLocaleString()} failed` : ""}
        </p>
      )}
    </div>
  );
}

function HomeMessage({ title, body, to, action }: { title: string; body: string; to: "/playlists"; action: string }) {
  return (
    <section className="border-y border-border py-5">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4"><Link to={to} search={{ mode: "tv" }} data-tv-focus data-zone-entry="true">{action}</Link></Button>
    </section>
  );
}
