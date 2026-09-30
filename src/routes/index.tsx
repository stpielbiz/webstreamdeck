import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Clapperboard, History, Star, Tv, ListVideo } from "lucide-react";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stream Deck — Your IPTV playlists in one player" },
      {
        name: "description",
        content:
          "Add your Xtream Codes login or M3U link and watch live TV, movies and series in the browser. Favourites, TV guide and resume where you left off.",
      },
      { property: "og:title", content: "Stream Deck — Your IPTV playlists in one player" },
      {
        property: "og:description",
        content:
          "Bring your own IPTV subscription. Live TV, movies and series with favourites and resume, on every device.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Tv,
    title: "Live TV that feels instant",
    body: "Categories, search and a docked player so switching channels never means losing your place.",
  },
  {
    icon: History,
    title: "Resume anything",
    body: "Every movie and episode remembers the exact second you stopped, on any device you sign in from.",
  },
  {
    icon: Star,
    title: "Favourites that stick",
    body: "Star channels, films and shows once and find them on the home screen from then on.",
  },
  {
    icon: CalendarClock,
    title: "What's on now and next",
    body: "A programme guide built from your provider's own listings, where they supply them.",
  },
  {
    icon: Clapperboard,
    title: "Movies and series, organised",
    body: "Posters, synopses, seasons and episode lists instead of one endless channel list.",
  },
  {
    icon: ListVideo,
    title: "Several sources at once",
    body: "Add as many Xtream logins or M3U links as you like and switch between them in a click.",
  },
];

function Landing() {
  const navigate = useNavigate();

  // A signed-in visitor (e.g. returning from Google sign-in) belongs on the dashboard.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground">
            <Tv className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">Stream Deck</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 -z-10 h-64 rounded-full bg-primary/15 blur-3xl"
        />
        <p className="mb-4 inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          Bring your own playlist
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Your IPTV subscription, finally with a player worth using.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Add your Xtream Codes login or M3U link and watch live TV, movies and series in the
          browser. Stream Deck remembers your favourites and exactly where you stopped watching.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Start your free 1-day trial</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">I already have one</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/get-app">Watch on Firestick</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Your first day is free. A yearly subscription activates your account after the trial.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Stream Deck hosts no channels of its own — you use your own subscription details.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Stream Deck is a player. You supply the playlist and are responsible for the content you
        access.
      </footer>
    </div>
  );
}
