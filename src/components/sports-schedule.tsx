import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Play } from "lucide-react";
import { getLeagueSchedule } from "@/lib/game-broadcasts.functions";
import { channelsByNetwork, suggestChannels } from "@/lib/channel-suggest";
import { SPORTS_LEAGUES, gameStatusLabel, visibleGames, type ScheduledGame } from "@/lib/sports-leagues";
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

function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000);
  const date = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return diff === 0 ? `Today · ${date}` : diff === 1 ? `Tomorrow · ${date}` : diff === -1 ? `Yesterday · ${date}` : date;
}

/** Today's games for one league; each suggested channel is a remote-friendly card. */
export function SportsSchedulePanel({ leagueKey, channels, onPlay, onExitLeft, onExitUp }: { leagueKey: string; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void; onExitLeft: () => void; onExitUp: () => void }) {
  const schedule = useLeagueSchedule([leagueKey]);
  const leagueInfo = SPORTS_LEAGUES.find((l) => l.key === leagueKey);
  const label = leagueInfo?.label ?? leagueKey;
  const logo = leagueInfo?.logo;
  const games = useMemo(() => visibleGames(schedule.data?.[leagueKey] ?? []), [schedule.data, leagueKey]);

  // Explicit remote movement over network buttons and channel cards by screen position.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const cur = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-sport-item]");
    if (!cur || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-sport-item]"));
    const r = cur.getBoundingClientRect();
    const box = (el: HTMLElement) => el.getBoundingClientRect();
    const go = (el?: HTMLElement) => { if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", inline: "nearest" }); } };
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const line = items.filter((el) => Math.abs(box(el).top - r.top) < 6).sort((a, b) => box(a).left - box(b).left);
      const i = line.indexOf(cur);
      if (event.key === "ArrowLeft") { if (i <= 0) onExitLeft(); else go(line[i - 1]); } else go(line[i + 1]);
      return;
    }
    const down = event.key === "ArrowDown";
    const cand = items.filter((el) => (down ? box(el).top > r.bottom - 4 : box(el).bottom < r.top + 4));
    if (!cand.length) { if (!down) onExitUp(); return; }
    const edge = down ? Math.min(...cand.map((el) => box(el).top)) : Math.max(...cand.map((el) => box(el).top));
    const cx = r.left + r.width / 2;
    const mid = (el: HTMLElement) => Math.abs(box(el).left + box(el).width / 2 - cx);
    go(cand.filter((el) => Math.abs(box(el).top - edge) < 6).sort((a, b) => mid(a) - mid(b))[0]);
  };

  return (
    <div data-tv-zone="live-guide" data-tv-zone-order="3" data-sports-panel onKeyDown={onKeyDown} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-auto rounded border border-border bg-card p-3" aria-label={`${label} today`}>
      {schedule.isLoading && (
        <div className="flex flex-col items-center gap-4 p-6" role="status">
          {logo ? <img src={logo} alt="" className="size-20 animate-pulse object-contain drop-shadow-lg" /> : <span className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary" />}
          <p className="text-sm font-semibold text-muted-foreground">Loading today's {label} games…</p>
          <div className="grid w-full grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
        </div>
      )}
      {!schedule.isLoading && games.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {label} games today.</p>}
      {games.map((game, gi) => {
        const day = dayLabel(game.startsAt);
        const showDay = gi === 0 || dayLabel(games[gi - 1]!.startsAt) !== day;
        return (
          <div key={game.id} className="space-y-3">
            {showDay && <h2 className="sticky top-0 z-10 -mx-3 bg-card px-3 py-1 font-display text-sm font-bold uppercase tracking-wide text-primary">{day}</h2>}
            <GameBlock game={game} logo={logo} label={label} first={gi === 0} channels={channels} onPlay={onPlay} />
          </div>
        );
      })}
    </div>
  );
}


function GameBlock({ game, logo, label, first, channels, onPlay }: { game: ScheduledGame; logo?: string | undefined; label: string; first: boolean; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void }) {
  const [network, setNetwork] = useState<string | null>(null);
  const groups = useMemo(() => (channels ? channelsByNetwork({ ...game, league: label }, channels) : []), [channels, game, label]);
  const mix = useMemo(() => (channels ? suggestChannels({ ...game, league: label }, channels, 8) : []), [channels, game, label]);
  const picks = network ? groups.find((g) => g.network === network)?.items ?? [] : mix;
  const status = gameStatusLabel(game);
  const chip = "h-9 rounded-full border px-3 text-xs font-semibold outline-none transition-transform focus:scale-105 focus:border-primary focus:ring-2 focus:ring-primary";
  return (
    <section data-sport-row className="relative isolate overflow-hidden rounded-lg border border-border bg-background/40 p-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {logo && <img src={logo} alt="" aria-hidden className="pointer-events-none absolute -right-6 top-1/2 -z-10 size-48 -translate-y-1/2 object-contain opacity-10" />}
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <TeamLogos logos={game.logos} />
        <h3 className="font-display text-base font-bold">{game.matchup}</h3>
        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", game.state === "in" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{status}</span>
        {game.detail && <span className="text-xs text-muted-foreground">{game.detail}</span>}
      </header>
      {groups.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" aria-label="Networks">
          {[{ network: "All", items: mix }, ...groups].map((g, i) => {
            const active = (network ?? "All") === g.network;
            return (
              <button
                key={g.network}
                type="button"
                data-tv-focus
                data-focus-glow
                data-sport-item
                data-sport-network
                data-zone-entry={first && i === 0 ? "true" : undefined}
                data-focus-key={first && i === 0 ? "sports-first-card" : undefined}
                aria-pressed={active}
                onClick={() => setNetwork(g.network === "All" ? null : g.network)}
                className={cn(chip, active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary", !g.items.length && "opacity-50")}
              >
                {g.network}{g.network !== "All" && <span className="ml-1 opacity-80">· {g.items.length || "none"}</span>}
              </button>
            );
          })}
        </div>
      )}
      {picks.length ? (
        <div className="grid grid-cols-4 gap-2">
          {picks.map((item) => {
            const { badge, title } = splitChannelName(item.name);
            return (
              <button
                key={item.id}
                type="button"
                data-tv-focus
                data-sport-item
                data-sport-card
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
      ) : <p className="text-xs text-muted-foreground">{network ? `No ${network} channels in your playlist.` : "No matching channels in your playlist."}</p>}
    </section>
  );
}

/** Small away/home team logos beside a matchup; hidden when a logo fails to load. */
export function TeamLogos({ logos }: { logos?: string[] | undefined }) {
  if (!logos?.length) return null;
  return (
    <span className="flex items-center gap-1">
      {logos.slice(0, 2).map((src) => (
        <img key={src} src={src} alt="" loading="lazy" className="size-8 object-contain drop-shadow" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ))}
    </span>
  );
}
