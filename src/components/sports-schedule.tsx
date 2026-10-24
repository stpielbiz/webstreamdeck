import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, Play } from "lucide-react";
import { getGameSummary, getLeagueSchedule } from "@/lib/game-broadcasts.functions";
import { channelsByNetwork, suggestChannels } from "@/lib/channel-suggest";
import { SPORTS_LEAGUES, gameStatusLabel, visibleGames, type ScheduledGame } from "@/lib/sports-leagues";
import { useSettings } from "@/lib/playlist-sync";
import type { CatalogItem } from "@/lib/iptv-types";
import { cn } from "@/lib/utils";
import { trace } from "@/lib/debug-log";

/** Leagues the account picked in Settings (empty when the Sports package is off). */
export function useSportsLeagues() {
  const settings = useSettings();
  const keys = settings.data?.sportsEnabled ? settings.data.sportsLeagues : [];
  return SPORTS_LEAGUES.filter((l) => keys.includes(l.key));
}

const SCHEDULE_STORE = "sd-league-schedule-v1";
const today = () => new Date().toLocaleDateString("en-CA");
type StoredSchedule = { day: string; at: number; data: Record<string, ScheduledGame[]> };

/** Saved schedules for today only; anything from an earlier day is discarded. */
function readStored(key: string): StoredSchedule | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const all = JSON.parse(localStorage.getItem(SCHEDULE_STORE) ?? "{}") as Record<string, StoredSchedule>;
    const hit = all[key];
    return hit && hit.day === today() ? hit : undefined;
  } catch { return undefined; }
}
function writeStored(key: string, data: Record<string, ScheduledGame[]>) {
  try {
    const all = JSON.parse(localStorage.getItem(SCHEDULE_STORE) ?? "{}") as Record<string, StoredSchedule>;
    const day = today();
    for (const k of Object.keys(all)) if (all[k]?.day !== day) delete all[k];
    all[key] = { day, at: Date.now(), data };
    localStorage.setItem(SCHEDULE_STORE, JSON.stringify(all));
  } catch { /* storage full or unavailable */ }
}

export function useLeagueSchedule(keys: string[]) {
  const fetchSchedule = useServerFn(getLeagueSchedule);
  const key = [...keys].sort().join(",");
  const stored = useMemo(() => readStored(key), [key]);
  return useQuery({
    queryKey: ["league-schedule", key, today()],
    queryFn: async () => { const data = await fetchSchedule({ data: { leagues: keys } }); writeStored(key, data); return data; },
    enabled: keys.length > 0,
    initialData: stored?.data,
    initialDataUpdatedAt: () => stored?.at,
    // Keep today's games on screen; refresh quietly in the background for live scores.
    staleTime: 5 * 60_000,
    gcTime: Infinity,
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
  // Show the animation first; match channels one game at a time after a short pause so the remote never stalls.
  const [ready, setReady] = useState(0);
  useEffect(() => { setReady(0); }, [leagueKey]);
  useEffect(() => {
    if (!channels || ready >= games.length) return;
    const started = performance.now();
    const t = window.setTimeout(() => { setReady((r) => r + 1); if (ready + 1 === games.length) trace(`Sports matching: ${games.length} games ready`, `${Math.round(performance.now() - started)} ms last step`); }, ready === 0 ? 300 : 16);
    return () => window.clearTimeout(t);
  }, [ready, games.length, channels]);
  const [openFinal, setOpenFinal] = useState<string | null>(null);
  const loading = schedule.isLoading || (games.length > 0 && ready === 0);

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
      {loading && (
        <div className="flex flex-col items-center gap-4 p-6" role="status">
          {logo ? <img src={logo} alt="" className="size-20 animate-pulse object-contain drop-shadow-lg" /> : <span className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary" />}
          <p className="text-sm font-semibold text-muted-foreground">Loading today's {label} games…</p>
          <div className="grid w-full grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
        </div>
      )}
      {!schedule.isLoading && games.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {label} games today.</p>}
      {!loading && games.length > 0 && <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Beta — channel suggestions are a best guess and can be wrong.</p>}
      {games.map((game, gi) => {
        const day = dayLabel(game.startsAt);
        const showDay = gi === 0 || dayLabel(games[gi - 1]!.startsAt) !== day;
        if (gi >= ready) return gi === 0 ? null : <div key={game.id} className="h-32 animate-pulse rounded-lg bg-muted" />;
        return (
          <div key={game.id} className="space-y-3">
            {showDay && <h2 className="sticky top-0 z-10 -mx-3 bg-card px-3 py-1 font-display text-sm font-bold uppercase tracking-wide text-primary">{day}</h2>}
            {game.state === "post" ? <FinalBlock game={game} first={gi === 0} open={openFinal === game.id} onToggle={() => setOpenFinal((o) => (o === game.id ? null : game.id))} /> : <GameBlock game={game} logo={logo} label={label} first={gi === 0} channels={channels} onPlay={onPlay} />}
          </div>
        );
      })}
    </div>
  );
}


/** Open network per game; survives remounts so Back from playback finds the card again. */
const openNetworks = new Map<string, string | null>();
const SCORE = "__score__";

function GameBlock({ game, logo, label, first, channels, onPlay }: { game: ScheduledGame; logo?: string | undefined; label: string; first: boolean; channels?: CatalogItem[] | undefined; onPlay: (item: CatalogItem) => void }) {
  const [network, setNetworkState] = useState<string | null>(() => openNetworks.get(game.id) ?? null);
  const setNetwork = (n: string | null) => { openNetworks.set(game.id, n); setNetworkState(n); };
  const groups = useMemo(() => (channels ? channelsByNetwork({ ...game, league: label }, channels).filter((g) => g.items.length > 0) : []), [channels, game, label]);
  const live = game.state === "in";
  const picks = network && network !== SCORE ? groups.find((g) => g.network === network)?.items ?? [] : [];
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
      {(groups.length > 0 || live) && (
        <div className="flex flex-wrap gap-2" aria-label="Networks">
          {live && (
            <button
              type="button"
              data-tv-focus
              data-focus-glow
              data-sport-item
              data-zone-entry={first ? "true" : undefined}
              data-focus-key={first ? "sports-first-card" : `sport-score-${game.id}`}
              aria-pressed={network === SCORE}
              aria-expanded={network === SCORE}
              onClick={() => setNetwork(network === SCORE ? null : SCORE)}
              className={cn(chip, network === SCORE ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary")}
            >
              Score details
            </button>
          )}
          {groups.map((g, i) => {
            const active = network === g.network;
            const entry = first && i === 0 && !live;
            return (
              <button
                key={g.network}
                type="button"
                data-tv-focus
                data-focus-glow
                data-sport-item
                data-sport-network
                data-zone-entry={entry ? "true" : undefined}
                data-focus-key={entry ? "sports-first-card" : undefined}
                aria-pressed={active}
                aria-expanded={active}
                onClick={() => setNetwork(active ? null : g.network)}
                className={cn(chip, active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary")}
              >
                {g.network}<span className="ml-1 opacity-80">· {g.items.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {groups.length === 0 && <p className={cn("text-xs text-muted-foreground", live && "mt-2")}>No matching channels in your playlist.</p>}
      {network === SCORE && live && <div className="mt-2 rounded border border-border"><ScoringSummary id={game.id} live /></div>}
      {picks.length > 0 && (
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
                data-focus-key={`sport-${game.id}-${item.id}`}
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
      )}
    </section>
  );
}

/** Finished game: final score; OK opens the scoring summary underneath. */
function FinalBlock({ game, first, open, onToggle }: { game: ScheduledGame; first: boolean; open: boolean; onToggle: () => void }) {
  const r = game.result ?? [];
  const nums = r.map((t) => Number(t.score));
  const best = Math.max(...nums);
  return (
    <section className="rounded-lg border border-border bg-background/40 animate-in fade-in duration-500">
      <button
        type="button"
        data-tv-focus
        data-focus-glow
        data-sport-item
        data-zone-entry={first ? "true" : undefined}
        data-focus-key={first ? "sports-first-card" : `sport-final-${game.id}`}
        aria-expanded={open}
        aria-label={`Final: ${game.matchup}`}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 rounded-lg p-3 text-left outline-none focus:ring-2 focus:ring-primary"
      >
        {r.length === 2 ? r.map((t, i) => (
          <span key={i} className="flex items-center gap-2">
            {i === 1 && <span className="text-muted-foreground">–</span>}
            {i === 0 && t.logo && <img src={t.logo} alt="" className="size-8 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {i === 0 && <span className="font-display text-base font-semibold">{t.name}</span>}
            <span className={cn("font-display text-xl tabular-nums", nums[i] === best && nums[0] !== nums[1] ? "font-bold" : "text-muted-foreground")}>{t.score}</span>
            {i === 1 && <span className="font-display text-base font-semibold">{t.name}</span>}
            {i === 1 && t.logo && <img src={t.logo} alt="" className="size-8 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          </span>
        )) : <span className="font-display text-base font-bold">{game.matchup}</span>}
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{game.final ?? "Final"}</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <ScoringSummary id={game.id} />}
    </section>
  );
}

function ScoringSummary({ id, live = false }: { id: string; live?: boolean }) {
  const fetchSummary = useServerFn(getGameSummary);
  const q = useQuery({ queryKey: ["game-summary", id, live], queryFn: () => fetchSummary({ data: { id } }), staleTime: live ? 60_000 : 24 * 3600_000, refetchInterval: live ? 60_000 : false, gcTime: live ? 5 * 60_000 : Infinity, retry: 1 });
  if (q.isLoading) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}</div>;
  const plays = q.data?.plays ?? [];
  if (!plays.length) return <p className="p-3 text-xs text-muted-foreground">{live ? "No goals yet." : "Scoring details not available."}</p>;
  const periods = [...new Set(plays.map((p) => p.periodLabel))];
  return (
    <div className="space-y-2 border-t border-border px-3 py-2 animate-in fade-in duration-300">
      {periods.map((label) => (
        <div key={label}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-primary">{label}</h4>
          <ul className="mt-1 space-y-1">
            {plays.filter((p) => p.periodLabel === label).map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{p.clock}</span>
                {p.logo ? <img src={p.logo} alt={p.team} className="size-5 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="w-8 font-semibold">{p.team}</span>}
                <span className="min-w-0 truncate"><span className="font-semibold">{p.scorer || p.text}</span>{p.scorer && <span className="text-muted-foreground"> ({p.assists.length ? p.assists.join(", ") : "unassisted"})</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
