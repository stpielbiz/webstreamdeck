import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clapperboard,
  LayoutGrid,
  ListVideo,
  LogOut,
  LogIn,
  MonitorPlay,
  ShieldCheck,
  Star,
  Tv,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { usePlaylists } from "@/components/playlist-context";
import { useIsAdmin } from "@/lib/use-admin";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/live", label: "Live TV", icon: Tv },
  { to: "/guide", label: "Guide", icon: CalendarClock },
  { to: "/movies", label: "Movies", icon: Clapperboard },
  { to: "/series", label: "Series", icon: MonitorPlay },
  { to: "/favorites", label: "Favourites", icon: Star },
  { to: "/playlists", label: "Playlists", icon: ListVideo },
  { to: "/device-login", label: "Log in another device", icon: LogIn },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { playlists, activeId, setActiveId } = usePlaylists();
  const { isAdmin } = useIsAdmin();
  const navItems = isAdmin
    ? [...NAV, { to: "/admin" as const, label: "Admin", icon: ShieldCheck }]
    : [...NAV];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // TV mode owns the whole screen — no sidebar, no mobile nav strip.
  if (pathname === "/tv" || pathname.startsWith("/tv/")) return <>{children}</>;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded bg-primary text-primary-foreground">
            <Tv className="size-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Stream Deck</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary",
              }}
              activeOptions={{ exact: to === "/dashboard" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 px-1">
          {playlists.length > 0 && (
            <div>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Source
              </p>
              <Select {...(activeId ? { value: activeId } : {})} onValueChange={setActiveId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Pick a playlist" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 overflow-x-auto border-b border-border bg-sidebar px-3 py-2 md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground/75"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
