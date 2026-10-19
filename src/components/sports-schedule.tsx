import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getLeagueSchedule } from "@/lib/game-broadcasts.functions";
import { suggestChannels } from "@/lib/channel-suggest";
import { SPORTS_LEAGUES, gameStatusLabel, visibleGames } from "@/lib/sports-leagues";
import { useSettings } from "@/lib/playlist-sync";
import type { CatalogItem } from "@/lib/iptv-types";
import { cn } from "@/lib/utils";

/** Leagues the account picked in Settings (empty when the Sports package is off). */
export function useSportsLeagues() {
  const settings = useSettings();
  const keys = settings.data?.sportsEnabled ? settings.data.sportsLeagues : [];
  return SPORTS_LEAGUES.filter((l) => keys.includes(l.key));
}

export function useLeagueSchedule(keys: string[]) {
  const fetchSchedule = useServerFn(getLeagueSchedule);
  return useQuery({
    queryKey: ["league-schedule", [...keys].sort().join(",")],
    queryFn: () => fetchSchedule({ data: { leagues: keys } }),
    enabled: keys.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** Today's games for one league with suggested playlist channels per game. */
export function SportsSchedulePanel({ leagueKey, channels, onPlay }: { leagueKey: string; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void }) {
  const schedule = useLeagueSchedule([leagueKey]);
  const label = SPORTS_LEAGUES.find((l) => l.key === leagueKey)?.label ?? leagueKey;
  const games = useMemo(() => visibleGames(schedule.data?.[leagueKey] ?? []), [schedule.data, leagueKey]);
  return (
    <div data-tv-zone="live-guide" data-tv-zone-order="3" className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-auto rounded border border-border bg-card p-2" aria-label={`${label} today`}>
      {schedule.isLoading && <p className="p-4 text-sm text-muted-foreground">Checking today's {label} games…</p>}
      {!schedule.isLoading && games.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {label} games today.</p>}
      {games.map((game, gi) => {
        const picks = channels ? suggestChannels({ ...game, league: label }, channels, 8) : [];
        const status = gameStatusLabel(game);
        return (
          <div key={game.id} className="rounded border border-border p-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {game.matchup}
              <span className={cn("rounded px-1.5 py-0.5 text-xs", game.state === "in" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{status}</span>
              {game.detail && <span className="text-xs font-normal text-muted-foreground">{game.detail}</span>}
            </p>
            {game.broadcasts.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground">On: {game.broadcasts.join(", ")}</p>}
            <div data-remote-row className="mt-1.5 flex flex-wrap gap-1.5">
              {picks.length ? picks.map((item, ci) => (
                <button key={item.id} type="button" data-tv-focus data-zone-entry={gi === 0 && ci === 0 ? "true" : undefined} data-focus-key={gi === 0 && ci === 0 ? "channel-sports-first" : undefined} onClick={() => onPlay(item)} className="rounded bg-secondary px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary">
                  {item.name}
                </button>
              )) : <span className="text-xs text-muted-foreground">No matching channels in your playlist.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
