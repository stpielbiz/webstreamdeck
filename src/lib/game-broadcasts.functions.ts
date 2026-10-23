import { createServerFn } from "@tanstack/react-start";
import type { GameInfo } from "@/lib/channel-suggest";
import { SPORTS_LEAGUES, periodLabel, type ScheduledGame, type ScoringPlay } from "@/lib/sports-leagues";

const LEAGUES: [string, string][] = [
  ["hockey/nhl", "NHL"], ["basketball/nba", "NBA"], ["football/nfl", "NFL"], ["baseball/mlb", "MLB"],
  ["soccer/usa.1", "MLS"], ["soccer/eng.1", "Premier League"], ["soccer/esp.1", "LaLiga"], ["soccer/uefa.champions", "Champions League"],
  ["rugby/164205", "Rugby"], ["rugby/244293", "Rugby"], ["rugby/289234", "Rugby"], ["rugby/180659", "Rugby"], ["rugby/270557", "Rugby"], ["rugby/267979", "Rugby"], ["rugby/242041", "Rugby"],
];
const NICKNAMES: Record<string, string> = { habs: "canadiens", leafs: "maple leafs", sens: "senators", bruins: "bruins", pens: "penguins", caps: "capitals", jays: "blue jays", niners: "49ers", sixers: "76ers", raps: "raptors", springboks: "south africa", boks: "south africa", "all blacks": "new zealand", wallabies: "australia", pumas: "argentina", "los pumas": "argentina" };
const RUGBY_DEFAULT = ["SuperSport", "Sky Sport", "Stan Sport", "TNT Sports", "Premier Sports", "FloRugby", "Peacock", "ITV", "BBC"];
// ESPN rarely lists Canadian networks; add the usual ones for Canadian NHL teams.
const CANADIAN_NHL: Record<string, string[]> = {
  canadiens: ["Sportsnet", "TVA Sports", "RDS", "TSN"], "maple leafs": ["Sportsnet", "TSN", "CBC"], senators: ["TSN", "Sportsnet", "RDS"],
  jets: ["TSN", "Sportsnet"], oilers: ["Sportsnet"], flames: ["Sportsnet"], canucks: ["Sportsnet"],
};

const cache = new Map<string, { at: number; value: GameInfo | null }>();
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

type EspnEvent = { id: string; name: string; date: string; status?: { type?: { state?: string; shortDetail?: string; completed?: boolean } }; competitions?: { competitors?: { team: Team; score?: string }[]; broadcasts?: { names?: string[] }[]; geoBroadcasts?: { media?: { shortName?: string } }[] }[] };

/** The schedule service returns nothing for date ranges, so fetch each day and merge. */
async function fetchEvents(path: string, from: Date, to: Date): Promise<EspnEvent[]> {
  const days = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime() + 86_400_000 - 1; t += 86_400_000) days.add(ymd(new Date(Math.min(t, to.getTime()))));
  const lists = await Promise.all([...days].map(async (day) => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day}`, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/json" } });
      if (!res.ok) return [];
      const json = await res.json() as { events?: EspnEvent[] };
      return json.events ?? [];
    } catch { return []; }
  }));
  const seen = new Map<string, EspnEvent>();
  for (const e of lists.flat()) if (e?.id && !seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
}

/** Official NHL TV codes -> network names playlists use. Canadian/national listings first. */
const NHL_CODES: Record<string, string> = {
  SN: "Sportsnet", "SN+": "Sportsnet+", SN1: "Sportsnet One", SNE: "Sportsnet East", SNO: "Sportsnet Ontario", SNP: "Sportsnet Pacific", SNW: "Sportsnet West", SN360: "Sportsnet 360",
  TVAS: "TVA Sports", TVAS2: "TVA Sports 2", CBC: "CBC", RDS: "RDS", RDS2: "RDS 2", TSN: "TSN", TSN1: "TSN 1", TSN2: "TSN 2", TSN3: "TSN 3", TSN4: "TSN 4", TSN5: "TSN 5", CITY: "Citytv",
  ESPN: "ESPN", "ESPN+": "ESPN+", ESPN2: "ESPN 2", ABC: "ABC", TNT: "TNT", TBS: "TBS", truTV: "truTV", MAX: "Max", "Prime Video": "Prime Video", NHLN: "NHL Network",
  MSG: "MSG", "MSG 2": "MSG 2", MSGSN: "MSG Sportsnet", NBCSCA: "NBC Sports California", NBCSP: "NBC Sports Philadelphia", NBCSBA: "NBC Sports Bay Area", NBCSCH: "NBC Sports Chicago", NBCSWA: "NBC Sports Washington", MNMT: "Monumental", ALT: "Altitude",
};
type NhlGame = { startTimeUTC: string; homeTeam?: { commonName?: { default?: string } }; tvBroadcasts?: { countryCode?: string; network?: string }[] };
const nhlCache = new Map<string, { at: number; value: Map<string, string[]> }>();

/** Exact TV listings from the official NHL schedule, keyed by start time + home team. */
async function nhlListings(from: Date): Promise<Map<string, string[]>> {
  const day = from.toISOString().slice(0, 10);
  const hit = nhlCache.get(day);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const map = new Map<string, string[]>();
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${day}`, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
    if (res.ok) {
      const json = await res.json() as { gameWeek?: { games?: NhlGame[] }[] };
      for (const g of (json.gameWeek ?? []).flatMap((d) => d.games ?? [])) {
        const tv = [...(g.tvBroadcasts ?? [])].sort((a, b) => (a.countryCode === "CA" ? 0 : 1) - (b.countryCode === "CA" ? 0 : 1));
        const names = tv.map((b) => { const code = (b.network ?? "").trim(); return NHL_CODES[code] ?? code; }).filter(Boolean);
        map.set(`${Date.parse(g.startTimeUTC)}|${(g.homeTeam?.commonName?.default ?? "").toLowerCase()}`, [...new Set(names)]);
      }
    }
  } catch { /* fall back to ESPN */ }
  nhlCache.set(day, { at: Date.now(), value: map });
  return map;
}

/** Prefer official NHL listings; only guess Canadian networks when nothing is listed anywhere. */
function nhlNames(listings: Map<string, string[]>, date: string, teams: Team[], espn: string[]): string[] {
  const t = Date.parse(date);
  for (const tm of teams) {
    const exact = listings.get(`${t}|${(tm.name ?? "").toLowerCase()}`);
    if (exact?.length) return exact;
  }
  if (espn.filter(Boolean).length) return espn;
  return teams.flatMap((tm) => CANADIAN_NHL[(tm.name ?? "").toLowerCase()] ?? []);
}

type Team = { logo?: string; displayName?: string; shortDisplayName?: string; name?: string; location?: string; abbreviation?: string };

export const findGameBroadcasts = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => ({ query: String(input?.query ?? "").slice(0, 60) }))
  .handler(async ({ data }): Promise<GameInfo | null> => {
    let q = data.query.toLowerCase().trim();
    q = NICKNAMES[q] ?? q;
    if (q.length < 3) return null;
    const hit = cache.get(q);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
    const now = new Date();
    const results = await Promise.all(LEAGUES.map(async ([path, league]) =>
      (await fetchEvents(path, new Date(now.getTime() - 6 * 3600_000), new Date(now.getTime() + 36 * 3600_000))).map((e) => ({ e, league }))));
    let found: GameInfo | null = null;
    for (const { e, league } of results.flat().sort((a, b) => a.e.date.localeCompare(b.e.date))) {
      if (e.status?.type?.completed) continue;
      const comp = e.competitions?.[0];
      const teams = (comp?.competitors ?? []).map((c) => c.team);
      const matched = teams.find((t) => [t.displayName, t.name, t.shortDisplayName].some((n) => n && (n.toLowerCase().includes(q) || (q.length >= 6 && q.includes(n.toLowerCase())))) || t.location?.toLowerCase() === q || t.abbreviation?.toLowerCase() === q);
      if (!matched) continue;
      let names = [
        ...(comp?.broadcasts ?? []).flatMap((b) => b.names ?? []),
        ...(comp?.geoBroadcasts ?? []).map((g) => g.media?.shortName ?? ""),
      ];
      if (league === "NHL") names = nhlNames(await nhlListings(new Date(now.getTime() - 6 * 3600_000)), e.date, teams, names);
      if (league === "Rugby" && names.filter(Boolean).length === 0) names.push(...RUGBY_DEFAULT);
      found = {
        matchup: e.name, startsAt: e.date, league,
        teams: teams.flatMap((t) => [t.displayName ?? "", t.name ?? ""]),
        broadcasts: [...new Set(names.filter(Boolean))],
        logos: [...teams].reverse().map((t) => t.logo ?? "").filter(Boolean),
      };
      break;
    }
    cache.set(q, { at: Date.now(), value: found });
    return found;
  });

const scheduleCache = new Map<string, { at: number; value: Record<string, ScheduledGame[]> }>();

/** Today's (and early tomorrow's) games for the picked leagues, with broadcasters. */
export const getLeagueSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: { leagues: string[] }) => ({ leagues: (input?.leagues ?? []).filter((k) => SPORTS_LEAGUES.some((l) => l.key === k)).slice(0, 20) }))
  .handler(async ({ data }): Promise<Record<string, ScheduledGame[]>> => {
    const cacheKey = [...data.leagues].sort().join(",");
    const hit = scheduleCache.get(`v5:${cacheKey}`);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
    const now = new Date();
    const out: Record<string, ScheduledGame[]> = {};
    await Promise.all(SPORTS_LEAGUES.filter((l) => data.leagues.includes(l.key)).map(async (league) => {
      const nhl = league.key === "NHL" ? await nhlListings(new Date(now.getTime() - 8 * 3600_000)) : new Map<string, string[]>();
      const lists = await Promise.all(league.paths.map(async (path) => {
        try {
          const json = { events: await fetchEvents(path, new Date(now.getTime() - 8 * 3600_000), new Date(now.getTime() + 30 * 3600_000)) } as { events?: { id: string; name: string; date: string; status?: { type?: { state?: string; shortDetail?: string } }; competitions?: { competitors?: { team: Team; score?: string }[]; broadcasts?: { names?: string[] }[]; geoBroadcasts?: { media?: { shortName?: string } }[] }[] }[] };
          return (json.events ?? []).map((e): ScheduledGame => {
            const comp = e.competitions?.[0];
            const teams = (comp?.competitors ?? []).map((c) => c.team);
            let names = [...(comp?.broadcasts ?? []).flatMap((b) => b.names ?? []), ...(comp?.geoBroadcasts ?? []).map((g) => g.media?.shortName ?? "")];
            if (league.key === "NHL") names = nhlNames(nhl, e.date, teams, names);
            if (league.key === "RUGBY" && !names.filter(Boolean).length) names.push(...RUGBY_DEFAULT);
            const state = e.status?.type?.state === "in" ? "in" : e.status?.type?.state === "post" ? "post" : "pre";
            const score = (comp?.competitors ?? []).map((c) => c.score).filter(Boolean).join("–");
            return {
              id: `${path}:${e.id}`, matchup: e.name, startsAt: e.date, state,
              detail: state === "in" ? [score, e.status?.type?.shortDetail].filter(Boolean).join(" · ") : "",
              endedAt: null,
              teams: teams.flatMap((t) => [t.displayName ?? "", t.name ?? ""]).filter(Boolean),
              broadcasts: [...new Set(names.filter(Boolean))],
              logos: [...teams].reverse().map((t) => t.logo ?? "").filter(Boolean),
              ...(state === "post" ? { result: [...(comp?.competitors ?? [])].reverse().map((c) => ({ name: c.team.shortDisplayName ?? c.team.name ?? c.team.displayName ?? "", logo: c.team.logo ?? "", score: c.score ?? "" })), final: e.status?.type?.shortDetail ?? "Final" } : {}),
            };
          });
        } catch { return []; }
      }));
      // Keep only games from today (local-ish window) onwards, ordered by start.
      const cutoff = now.getTime() + 30 * 3600_000;
      out[league.key] = lists.flat().filter((g) => Date.parse(g.startsAt) < cutoff && Date.parse(g.startsAt) > now.getTime() - 12 * 3600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }));
    scheduleCache.set(`v5:${cacheKey}`, { at: Date.now(), value: out });
    return out;
  });

const summaryCache = new Map<string, { at: number; value: { plays: ScoringPlay[] } }>();
type RawPlay = { scoringPlay?: boolean; period?: { number?: number }; clock?: { displayValue?: string }; team?: { id?: string }; text?: string; participants?: { type?: string; athlete?: { displayName?: string } }[] };

/** Scoring summary (goals, assists, time, period) for one finished game; id is "path:eventId". */
export const getGameSummary = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "");
    const at = id.lastIndexOf(":");
    const path = id.slice(0, at), event = id.slice(at + 1);
    if (!SPORTS_LEAGUES.some((l) => l.paths.includes(path)) || !/^\d+$/.test(event)) throw new Error("Unknown game");
    return { path, event };
  })
  .handler(async ({ data }): Promise<{ plays: ScoringPlay[] }> => {
    const key = `${data.path}:${data.event}`;
    const hit = summaryCache.get(key);
    if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.value;
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${data.path}/summary?event=${data.event}`, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/json" } });
    if (!res.ok) return { plays: [] };
    const json = (await res.json()) as { scoringPlays?: RawPlay[]; plays?: RawPlay[]; keyEvents?: RawPlay[]; header?: { competitions?: { competitors?: { team?: { id?: string; abbreviation?: string; logos?: { href?: string }[]; logo?: string } }[] }[] } };
    const teams = new Map<string, { abbr: string; logo: string }>();
    for (const c of json.header?.competitions?.[0]?.competitors ?? []) if (c.team?.id) teams.set(c.team.id, { abbr: c.team.abbreviation ?? "", logo: c.team.logos?.[0]?.href ?? c.team.logo ?? "" });
    const raw = json.scoringPlays?.length ? json.scoringPlays : (json.plays ?? []).filter((p) => p.scoringPlay).length ? (json.plays ?? []).filter((p) => p.scoringPlay) : (json.keyEvents ?? []).filter((p) => p.scoringPlay);
    const plays = raw.map((p): ScoringPlay => {
      const n = p.period?.number ?? 0;
      const text = p.text ?? "";
      const scorer = p.participants?.find((x) => x.type === "scorer")?.athlete?.displayName
        ?? text.match(/\.\s*([^.(]+?)\s*\(/)?.[1]?.trim() ?? "";
      let assists = (p.participants ?? []).filter((x) => x.type === "assister").map((x) => x.athlete?.displayName ?? "").filter(Boolean);
      if (!assists.length) { const m = text.match(/Assisted by ([^.]+)/i); if (m?.[1]) assists = m[1].split(/\s*(?:,| and )\s*/).filter(Boolean); }
      const t = teams.get(p.team?.id ?? "");
      return { period: n, periodLabel: periodLabel(data.path, n), clock: p.clock?.displayValue ?? "", team: t?.abbr ?? "", logo: t?.logo ?? "", scorer, assists, text };
    });
    const value = { plays };
    summaryCache.set(key, { at: Date.now(), value });
    return value;
  });
