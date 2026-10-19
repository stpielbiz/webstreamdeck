import { createServerFn } from "@tanstack/react-start";
import type { GameInfo } from "@/lib/channel-suggest";

const LEAGUES: [string, string][] = [
  ["hockey/nhl", "NHL"], ["basketball/nba", "NBA"], ["football/nfl", "NFL"], ["baseball/mlb", "MLB"],
  ["soccer/usa.1", "MLS"], ["soccer/eng.1", "Premier League"], ["soccer/esp.1", "LaLiga"], ["soccer/uefa.champions", "Champions League"],
];
const NICKNAMES: Record<string, string> = { habs: "canadiens", leafs: "maple leafs", sens: "senators", bruins: "bruins", pens: "penguins", caps: "capitals", jays: "blue jays", niners: "49ers", sixers: "76ers", raps: "raptors" };
// ESPN rarely lists Canadian networks; add the usual ones for Canadian NHL teams.
const CANADIAN_NHL: Record<string, string[]> = {
  canadiens: ["Sportsnet", "TVA Sports", "RDS", "TSN"], "maple leafs": ["Sportsnet", "TSN", "CBC"], senators: ["TSN", "Sportsnet", "RDS"],
  jets: ["TSN", "Sportsnet"], oilers: ["Sportsnet"], flames: ["Sportsnet"], canucks: ["Sportsnet"],
};

const cache = new Map<string, { at: number; value: GameInfo | null }>();
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

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
    const range = `${ymd(new Date(now.getTime() - 6 * 3600_000))}-${ymd(new Date(now.getTime() + 36 * 3600_000))}`;
    const results = await Promise.all(LEAGUES.map(async ([path, league]) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${range}`);
        if (!res.ok) return [];
        const json = await res.json() as { events?: { name: string; date: string; status?: { type?: { completed?: boolean } }; competitions?: { competitors?: { team: Team }[]; broadcasts?: { names?: string[] }[]; geoBroadcasts?: { media?: { shortName?: string } }[] }[] }[] };
        return (json.events ?? []).map((e) => ({ e, league }));
      } catch { return []; }
    }));
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
