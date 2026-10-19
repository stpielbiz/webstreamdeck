import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Play } from "lucide-react";
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

/** Provider names look like "US (ESPN+ 001) | Football: ..." — split into a short badge and a title. */
function splitChannelName(name: string) {
  const [head, ...rest] = name.split(/\s*\|\s*/);
  return rest.length ? { badge: head ?? "", title: rest.join(" | ") } : { badge: "", title: name };
}

/** Today's games for one league; each suggested channel is a remote-friendly card. */
export function SportsSchedulePanel({ leagueKey, channels, onPlay, onExitLeft, onExitUp }: { leagueKey: string; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void; onExitLeft: () => void; onExitUp: () => void }) {
  const schedule = useLeagueSchedule([leagueKey]);
  const label = SPORTS_LEAGUES.find((l) => l.key === leagueKey)?.label ?? leagueKey;
  const games = useMemo(() => visibleGames(schedule.data?.[leagueKey] ?? []), [schedule.data, leagueKey]);

  // Explicit remote movement: Left/Right within a game, Up/Down to the nearest card of the neighbouring game.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const card = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-sport-card]");
    if (!card) return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-sport-row]"));
    const row = card.closest<HTMLElement>("[data-sport-row]");
    if (!row) return;
    const cardsOf = (r: HTMLElement) => Array.from(r.querySelectorAll<HTMLElement>("[data-sport-card]"));
    const cards = cardsOf(row);
    const i = cards.indexOf(card);
    const stop = () => { event.preventDefault(); event.stopPropagation(); };
    const go = (el?: HTMLElement | null) => { if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", inline: "nearest" }); } };
    const rect = card.getBoundingClientRect();
    if (event.key === "ArrowLeft") { stop(); if (i === 0) onExitLeft(); else go(cards[i - 1]); }
    else if (event.key === "ArrowRight") { stop(); go(cards[i + 1]); }
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      stop();
      const down = event.key === "ArrowDown";
      // Within a wrapped grid first move to the line above/below in the same game.
      const sameRow = cards.filter((c) => { const r = c.getBoundingClientRect(); return down ? r.top > rect.bottom - 4 : r.bottom < rect.top + 4; });
      let targets = sameRow;
      if (!targets.length) {
        let ri = rows.indexOf(row) + (down ? 1 : -1);
        while (rows[ri] && !cardsOf(rows[ri]!).length) ri += down ? 1 : -1;
        if (!rows[ri]) { if (!down) onExitUp(); return; }
        targets = cardsOf(rows[ri]!);
        const tops = targets.map((c) => c.getBoundingClientRect().top);
        const line = down ? Math.min(...tops) : Math.max(...tops);
        targets = targets.filter((c) => Math.abs(c.getBoundingClientRect().top - line) < 4);
      } else {
        const tops = targets.map((c) => c.getBoundingClientRect().top);
        const line = down ? Math.min(...tops) : Math.max(...tops);
        targets = targets.filter((c) => Math.abs(c.getBoundingClientRect().top - line) < 4);
      }
      const cx = rect.left + rect.width / 2;
      go(targets.sort((a, b) => Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - cx) - Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - cx))[0]);
    }
  };

  return (
    <div data-tv-zone="live-guide" data-tv-zone-order="3" data-sports-panel onKeyDown={onKeyDown} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-auto rounded border border-border bg-card p-3" aria-label={`${label} today`}>
      {schedule.isLoading && <p className="p-4 text-sm text-muted-foreground">Checking today's {label} games…</p>}
      {!schedule.isLoading && games.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {label} games today.</p>}
      {games.map((game, gi) => {
        const picks = channels ? suggestChannels({ ...game, league: label }, channels, 8) : [];
        const status = gameStatusLabel(game);
        return (
          <section key={game.id} data-sport-row className="rounded-lg border border-border bg-background/40 p-3">
            <header className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold">{game.matchup}</h3>
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", game.state === "in" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{status}</span>
              {game.detail && <span className="text-xs text-muted-foreground">{game.detail}</span>}
              {game.broadcasts.length > 0 && <span className="w-full truncate text-xs text-muted-foreground">On: {game.broadcasts.join(", ")}</span>}
            </header>
            {picks.length ? (
              <div className="grid grid-cols-4 gap-2">
                {picks.map((item, ci) => {
                  const { badge, title } = splitChannelName(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tv-focus
                      data-sport-card
                      data-zone-entry={gi === 0 && ci === 0 ? "true" : undefined}
                      data-focus-key={gi === 0 && ci === 0 ? "sports-first-card" : undefined}
                      onClick={() => onPlay(item)}
                      className="flex h-20 min-w-0 items-center gap-2 rounded-lg border border-border bg-secondary p-2 text-left outline-none transition-transform focus:scale-[1.03] focus:border-primary focus:bg-primary focus:text-primary-foreground"
                    >
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                        {item.image ? <img src={item.image} alt="" loading="lazy" className="size-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <Play className="size-4 fill-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        {badge && <span className="block truncate text-[11px] font-semibold uppercase opacity-80">{badge}</span>}
                        <span className="line-clamp-2 text-xs font-medium leading-tight">{title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-xs text-muted-foreground">No matching channels in your playlist.</p>}
          </section>
        );
      })}
    </div>
  );
}
