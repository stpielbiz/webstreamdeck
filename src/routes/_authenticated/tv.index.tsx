import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Clapperboard, Download, ListVideo, MonitorPlay, ShieldCheck, Star, Tv } from "lucide-react";
import { useEffect, useState } from "react";

import { TvGrid, TvShell, TvTile } from "@/components/tv-shell";
import { usePlaylists } from "@/components/playlist-context";
import { useFavorites, useProgress } from "@/lib/library-hooks";
import { SectionMenu } from "@/components/layered-navigation";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/use-admin";

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
    ],
  }),
  component: TvHome,
});

function TvHome() {
  const navigate = useNavigate();
  const { activeId } = usePlaylists();
  const { data: progress } = useProgress();
  const { data: favorites } = useFavorites();
  const { isAdmin } = useIsAdmin();
  const [focusedSection, setFocusedSection] = useState("Home");

  const resume = (progress ?? []).filter(
    (row) => row.playlistId === activeId && !row.completed && row.positionSeconds > 30,
  );
  const favouriteChannels = (favorites ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind === "live",
  );
  const favouriteTitles = (favorites ?? []).filter(
    (row) => row.playlistId === activeId && row.itemKind !== "live",
  );

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
          <SectionMenu tv current="Home" focused={focusedSection} onFocusItem={setFocusedSection} compact zoneOrder={1} />
        </aside>
        <main data-tv-zone="home-content" data-tv-zone-order="2" className="scrollbar-thin min-h-0 overflow-y-auto overscroll-contain pr-2">
          {focusedSection === "Home" ? (
            <div className="space-y-6 pb-6">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Your library</p>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick up where you stopped or jump into a favourite.</p>
              </div>
              {!activeId && <HomeMessage title="No playlist yet" body="Add a playlist to see your channels, movies and shows here." to="/playlists" action="Add playlist" />}
              <HomeShelf title="Continue watching" empty="Nothing to resume yet.">
                {resume.slice(0, 10).map((row, index) => (
                  <TvTile
                    key={`${row.itemKind}-${row.itemId}`}
                    title={row.title}
                    image={row.posterUrl}
                    subtitle={row.external ? "External player" : row.itemKind === "episode" ? `S${row.season} E${row.episode}` : row.durationSeconds ? `${Math.max(1, Math.round((row.durationSeconds - row.positionSeconds) / 60))} min left` : null}
                    progress={row.external ? null : row.durationSeconds ? row.positionSeconds / row.durationSeconds : null}
                    zoneEntry={index === 0}
                    onSelect={() => void navigate(row.itemKind === "episode" && row.seriesId ? { to: "/tv/watch/series/$id", params: { id: row.seriesId } } : { to: "/tv/watch/movie/$id", params: { id: row.itemId } })}
                  />
                ))}
              </HomeShelf>
              <HomeShelf title="Favourite channels" empty="Star channels to keep them close.">
                {favouriteChannels.slice(0, 10).map((row) => (
                  <TvTile key={row.id} title={row.title} image={row.logoUrl} onSelect={() => void navigate({ to: "/tv/live", search: { channel: row.itemId } })} />
                ))}
              </HomeShelf>
              <HomeShelf title="Favourite movies and shows" empty="Star a movie or show to find it here.">
                {favouriteTitles.slice(0, 10).map((row) => (
                  <TvTile key={row.id} title={row.title} image={row.logoUrl} onSelect={() => void navigate(row.itemKind === "series" ? { to: "/tv/watch/series/$id", params: { id: row.itemId } } : { to: "/tv/watch/movie/$id", params: { id: row.itemId } })} />
                ))}
              </HomeShelf>
            </div>
          ) : (
            <SectionPreview section={focusedSection} resumeCount={resume.length} favouriteCount={favouriteChannels.length + favouriteTitles.length} isAdmin={isAdmin} />
          )}
        </main>
      </div>
    </TvShell>
  );
}

function HomeShelf({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <h3 className="mb-3 font-display text-xl font-semibold">{title}</h3>
      {hasItems ? <TvGrid>{children}</TvGrid> : <p className="rounded border border-dashed border-border p-5 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

const PREVIEWS = {
  Guide: { icon: CalendarClock, title: "TV guide", body: "See what is playing now and what comes next.", to: "/guide", action: "Open guide" },
  "Live TV": { icon: Tv, title: "Live TV", body: "Browse channels by category and start watching on this device.", to: "/tv/live", action: "Browse channels" },
  Movies: { icon: Clapperboard, title: "Movies", body: "Browse your movie library by system category, year, or title.", to: "/tv/movies", action: "Browse movies" },
  Shows: { icon: MonitorPlay, title: "Shows", body: "Find series, seasons, and episodes from your playlist.", to: "/tv/series", action: "Browse shows" },
  Favourites: { icon: Star, title: "Favourites", body: "Your saved channels, movies, and shows in one place.", to: "/tv/favorites", action: "Open favourites" },
  Playlists: { icon: ListVideo, title: "Playlists", body: "Add or switch the IPTV source used by Stream Deck.", to: "/playlists", action: "Manage playlists" },
  "Get the TV app": { icon: Download, title: "Get the TV app", body: "Download the latest Stream Deck app for Fire TV.", to: "/download", action: "Open download page" },
  Admin: { icon: ShieldCheck, title: "Admin", body: "Manage organisation tools and connection logs.", to: "/admin", action: "Open admin" },
} as const;

function SectionPreview({ section, resumeCount, favouriteCount, isAdmin }: { section: string; resumeCount: number; favouriteCount: number; isAdmin: boolean }) {
  const preview = PREVIEWS[section as keyof typeof PREVIEWS];
  if (!preview || (section === "Admin" && !isAdmin)) return null;
  const Icon = preview.icon;
  return (
    <div className="flex min-h-full items-center justify-center py-8">
      <section className="w-full max-w-3xl border-y border-border py-10">
        <Icon className="size-10 text-primary" />
        <p className="mt-5 text-xs font-semibold uppercase text-primary">Focused section</p>
        <h2 className="mt-1 font-display text-4xl font-bold">{preview.title}</h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{preview.body}</p>
        {(section === "Favourites" || section === "Movies" || section === "Shows") && (
          <p className="mt-4 text-sm text-muted-foreground">{resumeCount} waiting to resume · {favouriteCount} favourites</p>
        )}
        <Button asChild size="lg" className="mt-7">
          <Link to={preview.to} data-tv-focus data-zone-entry="true">{preview.action}</Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">Press OK on the menu to open, or press Right to use this button.</p>
      </section>
    </div>
  );
}

function HomeMessage({ title, body, to, action }: { title: string; body: string; to: "/playlists"; action: string }) {
  return (
    <section className="border-y border-border py-5">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4"><Link to={to} data-tv-focus data-zone-entry="true">{action}</Link></Button>
    </section>
  );
}
