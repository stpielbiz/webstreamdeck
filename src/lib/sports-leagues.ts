/** Browser-safe list of leagues for the Sports package and game lookups. */
export const SPORTS_LEAGUES: { key: string; label: string; paths: string[]; logo?: string }[] = [
  { key: "NHL", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png", label: "NHL", paths: ["hockey/nhl"] },
  { key: "NBA", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png", label: "NBA", paths: ["basketball/nba"] },
  { key: "NFL", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png", label: "NFL", paths: ["football/nfl"] },
  { key: "MLB", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png", label: "MLB", paths: ["baseball/mlb"] },
  { key: "MLS", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/mls.png", label: "MLS", paths: ["soccer/usa.1"] },
  { key: "EPL", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png", label: "Premier League", paths: ["soccer/eng.1"] },
  { key: "LALIGA", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png", label: "LaLiga", paths: ["soccer/esp.1"] },
  { key: "UCL", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png", label: "Champions League", paths: ["soccer/uefa.champions"] },
  { key: "RUGBY", label: "Rugby", paths: ["rugby/164205", "rugby/244293", "rugby/289234", "rugby/180659", "rugby/270557", "rugby/267979", "rugby/242041"] },
];

export const SPORTS_CATEGORY_PREFIX = "sports:";

export type ScheduledGame = {
  id: string;
  matchup: string;
  startsAt: string;
  state: "pre" | "in" | "post";
  detail: string;
  endedAt: string | null;
  teams: string[];
  broadcasts: string[];
};

/** Label shown in the guide: start time later, "In progress" now, "Final" after. */
export function gameStatusLabel(game: Pick<ScheduledGame, "state" | "startsAt">, locale?: string): string {
  if (game.state === "in") return "In progress";
  if (game.state === "post") return "Final";
  return new Date(game.startsAt).toLocaleTimeString(locale ?? [], { hour: "numeric", minute: "2-digit" });
}

/** Finished games stay listed for 2 hours (from end, or ~3h after start), then drop off. */
export function visibleGames(games: ScheduledGame[], now = Date.now()): ScheduledGame[] {
  return games.filter((g) => {
    if (g.state !== "post") return true;
    const end = g.endedAt ? Date.parse(g.endedAt) : Date.parse(g.startsAt) + 3 * 3600_000;
    return now - end < 2 * 3600_000;
  });
}
