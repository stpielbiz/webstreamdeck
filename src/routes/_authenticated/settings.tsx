import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Film, Monitor, PauseCircle, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SettingToggleCard } from "@/components/setting-toggle-card";
import { SPORTS_LEAGUES } from "@/lib/sports-leagues";
import { useSaveSettings, useSettings } from "@/lib/playlist-sync";
import { usePlaylists } from "@/components/playlist-context";
import { requestLibraryRefresh, runBulkRefresh, stopBulkRefresh, useBulkRefreshState, getBulkRefreshState, useLibraryRefreshStatus } from "@/lib/library-sync";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { refreshTitles } from "@/lib/metadata.functions";
import type { UserSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: z.object({ mode: z.literal("tv").optional() }),
  head: () => ({
    meta: [
      { title: "Settings — Stream Deck" },
      { name: "description", content: "Choose how Stream Deck handles your playlists and viewing history." },
      { property: "og:title", content: "Settings — Stream Deck" },
      { property: "og:description", content: "Personal Stream Deck preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

let detailsStopped = false;

function SettingsPage() {
  const { mode } = Route.useSearch();
  const settings = useSettings();
  const save = useSaveSettings();
  const current: UserSettings = {
    syncPlaylists: settings.data?.syncPlaylists ?? false,
    screenSize: settings.data?.screenSize ?? "large",
    backgroundUpdates: settings.data?.backgroundUpdates ?? true,
    sportsEnabled: settings.data?.sportsEnabled ?? false,
    sportsLeagues: settings.data?.sportsLeagues ?? [],
  };
  const enabled = current.syncPlaylists;
  const screenSize = current.screenSize;
  const { activeId, active } = usePlaylists();
  const refresh = useLibraryRefreshStatus();
  const bulk = useBulkRefreshState();
  const [detailsProgress, setDetailsProgress] = useState<Record<"movie" | "series", { done: number; total: number; status: "waiting" | "running" | "done" | "stopped" }> | null>(null);
  const client = useQueryClient();
  const refreshFn = useServerFn(refreshTitles);

  const update = (patch: Partial<UserSettings>, ok: string, fail: string) =>
    save.mutate({ ...current, ...patch }, {
      onSuccess: () => toast.success(ok),
      onError: () => toast.error(fail),
    });
  const toggle = (value: boolean) =>
    update({ syncPlaylists: value }, value ? "Playlist sync is on" : "Playlist sync is off", "Could not save the setting. Try again.");
  const chooseScreenSize = (value: "large" | "medium" | "small") =>
    update({ screenSize: value }, `TV display size set to ${value}`, "Could not save the display size. Try again.");
  const toggleBackground = (value: boolean) => {
    if (!value) stopBulkRefresh();
    update({ backgroundUpdates: value }, value ? "Background updates are on" : "All background updates stopped", "Could not save the setting. Try again.");
  };

  const updateDetails = async () => {
    if (!activeId) return;
    detailsStopped = false;
    type P = { done: number; total: number; status: "waiting" | "running" | "done" | "stopped" };
    const progress: Record<"movie" | "series", P> = {
      movie: { done: 0, total: 0, status: "waiting" },
      series: { done: 0, total: 0, status: "waiting" },
    };
    setDetailsProgress({ ...progress });
    toast("Updating movie & show details. Please wait until it's done.");
    for (const kind of ["movie", "series"] as const) {
      if (detailsStopped) break;
      await runBulkRefresh(client, activeId, kind, ({ data }) => refreshFn({ data: { ...data, playlistId: activeId } }));
      const s = getBulkRefreshState();
      progress[kind] = { done: s.done, total: s.total, status: detailsStopped ? "stopped" : "done" };
      setDetailsProgress({ ...progress });
    }
  };
  const stopDetails = () => { detailsStopped = true; stopBulkRefresh(); };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <span data-remote-row>
        <Button asChild variant="ghost" data-tv-focus data-layer-back>
          <Link to={mode === "tv" ? "/tv" : "/dashboard"}><ArrowLeft className="size-4" /> {mode === "tv" ? "Back to TV Home" : "Back"}</Link>
        </Button>
        </span>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 rounded-xl border border-border bg-card p-5">
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-semibold"><Monitor className="size-4 text-primary" /> TV display size</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Large uses bigger menus and cards. Medium and Small fit more titles on Fire TV screens.
          </span>
        </span>
        <div data-remote-row className="flex shrink-0 gap-2" role="group" aria-label="TV display size">
          {(["large", "medium", "small"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              data-tv-focus
              data-zone-entry={value === screenSize ? "true" : undefined}
              data-focus-key={`setting-screen-${value}`}
              size="sm"
              variant={screenSize === value ? "default" : "outline"}
              aria-pressed={screenSize === value}
              disabled={settings.isLoading || save.isPending}
              onClick={() => chooseScreenSize(value)}
            >
              {value[0]?.toUpperCase()}{value.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div data-remote-row>
        <SettingToggleCard
          title="Sync my playlists"
          description={<>
            Continue watching follows you across your playlists. If you start a movie or episode on one playlist,
            you can resume it at the same spot on another playlist that has the same title.
          </>}
          checked={enabled}
          disabled={settings.isLoading || save.isPending}
          onToggle={toggle}
          focusKey="setting-sync-playlists"
        />
      </div>
      <div data-remote-row>
        <SettingToggleCard
          icon={<PauseCircle className="size-4 text-primary" />}
          title="Background updates"
          description={<>
            When on, your channels, movies, shows, TV guide and title details update quietly in the background.
            Turn off to stop all background updates — the app then uses what is already saved. The update buttons below still work when you press them.
          </>}
          checked={current.backgroundUpdates}
          disabled={settings.isLoading || save.isPending}
          onToggle={toggleBackground}
          focusKey="setting-background-updates"
        />
      </div>
      <div data-remote-row>
        <SettingToggleCard
          icon={<Trophy className="size-4 text-primary" />}
          title="Sports package"
          description={<>Adds a "today" category in Live TV for each league you pick, listing its games with start times and the channels in your playlist that may show them.</>}
          checked={current.sportsEnabled}
          disabled={settings.isLoading || save.isPending}
          onToggle={(value) => update({ sportsEnabled: value }, value ? "Sports package is on" : "Sports package is off", "Could not save the setting. Try again.")}
          focusKey="setting-sports"
        />
      </div>
      {current.sportsEnabled && (
        <div className="grid grid-cols-2 gap-3 pl-4 sm:grid-cols-3">
          {SPORTS_LEAGUES.map((league) => {
            const on = current.sportsLeagues.includes(league.key);
            return (
              <div key={league.key} data-remote-row>
                <SettingToggleCard
                  title={league.label}
                  description={on ? "Shown in Live TV" : "Hidden"}
                  checked={on}
                  disabled={settings.isLoading || save.isPending}
                  onToggle={(value) => update({ sportsLeagues: value ? [...current.sportsLeagues, league.key] : current.sportsLeagues.filter((k) => k !== league.key) }, value ? `${league.label} added to Live TV` : `${league.label} removed`, "Could not save the setting. Try again.")}
                  focusKey={`setting-league-${league.key}`}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-start justify-between gap-6 rounded-xl border border-border bg-card p-5">
        <span>
          <span className="flex items-center gap-2 font-semibold"><Film className="size-4 text-primary" /> Update movie &amp; show details</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Fills in genres, posters, descriptions and cast for every movie and show{active ? ` in “${active.name}”` : ""}.
            This can take a while for large libraries. Please wait on this screen until the update is done for the best result.
          </span>
          {(bulk.running || detailsProgress) && (
            <span data-remote-row className="mt-3 flex items-center gap-4">
              <span className="min-w-0 flex-1 space-y-2">
                {(["movie", "series"] as const).map((kind) => {
                  const live = bulk.running && bulk.kind === kind;
                  const saved = detailsProgress?.[kind];
                  const done = live ? bulk.done : saved?.done ?? 0;
                  const total = live ? bulk.total : saved?.total ?? 0;
                  const status = live ? "running" : saved?.status ?? "waiting";
                  const pct = status === "done" ? 100 : total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                  return (
                    <span key={kind} className="grid grid-cols-[4rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                      <span className="font-medium">{kind === "movie" ? "Movies" : "Shows"}</span>
                      <Progress value={pct} className="h-2" />
                      <span className="text-right tabular-nums text-muted-foreground">
                        {status === "waiting" ? "Waiting" : status === "stopped" ? `${pct}% ■` : `${pct}%`}
                      </span>
                    </span>
                  );
                })}
                {bulk.running && <span className="block text-sm font-medium text-primary">Please wait until the update is done.</span>}
              </span>
              {bulk.running && (
                <Button data-tv-focus data-focus-key="setting-details-stop" variant="outline" onClick={stopDetails}>Stop</Button>
              )}
            </span>
          )}
        </span>
        <div data-remote-row className="flex shrink-0 gap-2">
          {!bulk.running && (
            <Button data-tv-focus data-focus-key="setting-details-update" disabled={!activeId} onClick={() => void updateDetails()}>
              <RefreshCw className="size-4" /> Update details now
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-start justify-between gap-6 rounded-xl border border-border bg-card p-5">
        <span>
          <span className="block font-semibold">Update library &amp; TV guide</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Deletes the saved channels, movies, shows and TV guide on this device and downloads fresh copies
            {active ? ` from “${active.name}”` : " from your playlist"}. You can keep browsing while it runs. Favourites and watch history are kept.
          </span>
          {refresh.running && (
            <span className="mt-2 block animate-pulse text-sm text-primary">
              Updating: {refresh.phase}{refresh.total > 0 ? ` ${refresh.done}/${refresh.total}` : "…"}
            </span>
          )}
        </span>
        <div data-remote-row className="shrink-0"><Button
          data-tv-focus
          data-focus-key="setting-refresh-library"
          disabled={!activeId || refresh.running}
          onClick={() => { if (activeId) { requestLibraryRefresh(activeId); toast("Updating your library in the background"); } }}
        >
          <RefreshCw className={refresh.running ? "size-4 animate-spin" : "size-4"} /> {refresh.running ? "Updating…" : "Update now"}
        </Button></div>
      </div>
    </div>
  );
}
