import { BrandMark, BrandName } from "@/components/brand";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, History, Layers, ListVideo, RefreshCw, Search, ShieldCheck, Star, Tv, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSpatialNav } from "@/lib/use-spatial-nav";
import { isFireTvDevice } from "@/lib/fire-tv-device";
import {
  HOME_ACTIONS, HOME_FEATURES, HOME_FEATURES_TITLE, HOME_FOOTER, HOME_HERO, HOME_STEPS, HOME_STEPS_TITLE,
} from "@/content/homepage";

const ICONS: Record<string, LucideIcon> = {
  tv: Tv, film: Clapperboard, layers: Layers, star: Star, search: Search,
  history: History, refresh: RefreshCw, list: ListVideo, shield: ShieldCheck,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jolzplay — IPTV player for Fire Stick and every screen" },
      { name: "description", content: "Watch your Xtream Codes or M3U playlist with a live guide, franchises, favourites, actor search and resume — built for the Fire Stick remote." },
      { property: "og:title", content: "Jolzplay — IPTV player for Fire Stick and every screen" },
      { property: "og:description", content: "Live TV, movies and shows from your own playlist, with franchises, favourites and actor search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [tv, setTv] = useState(false);
  const firstRef = useRef<HTMLAnchorElement>(null);
  useSpatialNav();

  useEffect(() => {
    const onTv = isFireTvDevice();
    setTv(onTv);
    const home = onTv ? "/tv" : "/dashboard";
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: home, replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) navigate({ to: home, replace: true });
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [navigate]);

  useEffect(() => { firstRef.current?.focus({ preventScroll: true }); }, [tv]);

  const actions = tv ? [...HOME_ACTIONS].sort((a, b) => Number(!!b.tvFirst) - Number(!!a.tvFirst)) : HOME_ACTIONS;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-6">
        <BrandMark className="size-9" />
        <span className="font-display text-xl font-bold"><BrandName /></span>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-12 pt-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 -z-10 h-64 rounded-full bg-primary/15 blur-3xl" />
        <p className="mb-4 inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">{HOME_HERO.badge}</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">{HOME_HERO.title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{HOME_HERO.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {actions.map((action, index) => (
            <Button key={action.label} asChild size="lg" variant={tv && index === 0 ? "default" : action.style === "primary" ? "default" : action.style} className="h-14 px-6 text-base">
              <Link to={action.to} data-tv-focus ref={index === 0 ? firstRef : undefined}>{action.label}</Link>
            </Button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{HOME_HERO.note}</p>
        <p className="mt-2 text-xs text-muted-foreground">{HOME_HERO.disclaimer}</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <h2 className="mb-4 font-display text-2xl font-bold">{HOME_STEPS_TITLE}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {HOME_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-border bg-card p-5">
              <span className="font-display text-3xl font-bold text-primary">{index + 1}</span>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-4 font-display text-2xl font-bold">{HOME_FEATURES_TITLE}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FEATURES.map(({ icon, title, body }) => {
            const Icon = ICONS[icon] ?? Tv;
            return (
              <Link key={title} to="/auth" data-tv-focus className="block rounded-xl border border-border bg-card p-5 transition hover:border-primary">
                <Icon className="size-6 text-primary" />
                <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground"><p>{HOME_FOOTER}</p><Button asChild variant="link" className="mt-2"><Link to="/contact" data-tv-focus>Contact us</Link></Button></footer>
    </div>
  );
}
