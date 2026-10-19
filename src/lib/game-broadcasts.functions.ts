import { createServerFn } from "@tanstack/react-start";
import type { GameInfo } from "@/lib/channel-suggest";
import { SPORTS_LEAGUES, type ScheduledGame } from "@/lib/sports-leagues";

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

type Team = { displayName?: string; shortDisplayName?: string; name?: string; location?: string; abbreviation?: string };

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
      const names = [
        ...(comp?.broadcasts ?? []).flatMap((b) => b.names ?? []),
        ...(comp?.geoBroadcasts ?? []).map((g) => g.media?.shortName ?? ""),
      ];
      if (league === "NHL") for (const t of teams) names.push(...(CANADIAN_NHL[(t.name ?? "").toLowerCase()] ?? []));
      if (league === "Rugby" && names.filter(Boolean).length === 0) names.push(...RUGBY_DEFAULT);
      found = {
        matchup: e.name, startsAt: e.date, league,
        teams: teams.flatMap((t) => [t.displayName ?? "", t.name ?? ""]),
        broadcasts: [...new Set(names.filter(Boolean))],
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
    const hit = scheduleCache.get(`v2:${cacheKey}`);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
    const now = new Date();
    const out: Record<string, ScheduledGame[]> = {};
    await Promise.all(SPORTS_LEAGUES.filter((l) => data.leagues.includes(l.key)).map(async (league) => {
      const lists = await Promise.all(league.paths.map(async (path) => {
        try {
          const json = { events: await fetchEvents(path, new Date(now.getTime() - 8 * 3600_000), new Date(now.getTime() + 30 * 3600_000)) } as { events?: { id: string; name: string; date: string; status?: { type?: { state?: string; shortDetail?: string } }; competitions?: { competitors?: { team: Team; score?: string }[]; broadcasts?: { names?: string[] }[]; geoBroadcasts?: { media?: { shortName?: string } }[] }[] }[] };
          return (json.events ?? []).map((e): ScheduledGame => {
            const comp = e.competitions?.[0];
            const teams = (comp?.competitors ?? []).map((c) => c.team);
            const names = [...(comp?.broadcasts ?? []).flatMap((b) => b.names ?? []), ...(comp?.geoBroadcasts ?? []).map((g) => g.media?.shortName ?? "")];
            if (league.key === "NHL") for (const t of teams) names.push(...(CANADIAN_NHL[(t.name ?? "").toLowerCase()] ?? []));
            if (league.key === "RUGBY" && !names.filter(Boolean).length) names.push(...RUGBY_DEFAULT);
            const state = e.status?.type?.state === "in" ? "in" : e.status?.type?.state === "post" ? "post" : "pre";
            const score = (comp?.competitors ?? []).map((c) => c.score).filter(Boolean).join("–");
            return {
              id: `${path}:${e.id}`, matchup: e.name, startsAt: e.date, state,
              detail: state === "in" ? [score, e.status?.type?.shortDetail].filter(Boolean).join(" · ") : "",
              endedAt: null,
              teams: teams.flatMap((t) => [t.displayName ?? "", t.name ?? ""]).filter(Boolean),
              broadcasts: [...new Set(names.filter(Boolean))],
            };
          });
        } catch { return []; }
      }));
      // Keep only games from today (local-ish window) onwards, ordered by start.
      const cutoff = now.getTime() + 30 * 3600_000;
      out[league.key] = lists.flat().filter((g) => Date.parse(g.startsAt) < cutoff && Date.parse(g.startsAt) > now.getTime() - 12 * 3600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }));
    scheduleCache.set(`v2:${cacheKey}`, { at: Date.now(), value: out });
    return out;
  });
