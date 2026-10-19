/** Browser-safe matching of broadcaster names to playlist channel names. */
import type { CatalogItem } from "@/lib/iptv-types";

export type GameInfo = {
  matchup: string;
  startsAt: string;
  league: string;
  teams: string[];
  broadcasts: string[];
};

const NOISE = /\b(hd|fhd|uhd|sd|4k|hevc|h265|raw|backup|vip|60fps|50fps|ca|us|usa|uk|en|fr|ott)\b/g;

export function normalizeChannel(name: string): string {
  return ` ${name
    .toLowerCase()
    .replace(/^\s*[[(]?[a-z]{2,3}[\])]?\s*[:|\-]\s*/, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Extra spellings providers commonly use for a network. */
const ALIASES: Record<string, string[]> = {
  sportsnet: ["sportsnet", "sn one", "sn1", "sn 1", "sn360", "sn east", "sn west", "sn ontario", "sn pacific"],
  "tva sports": ["tva sports", "tvasports"],
  tsn: ["tsn", "tsn1", "tsn2", "tsn3", "tsn4", "tsn5"],
  rds: ["rds", "rds2", "rds info"],
  cbc: ["cbc"],
  "nhl network": ["nhl network"],
  "espn plus": ["espn plus"],
  espn: ["espn"],
  "prime video": ["prime video", "amazon prime"],
  tnt: ["tnt"],
  msg: ["msg"],
  "fox": ["fox"],
  supersport: ["supersport", "ss rugby", "ss variety", "ss grandstand", "ss action"],
  "sky sport": ["sky sport", "sky sports"],
  "stan sport": ["stan sport"],
  "tnt sports": ["tnt sports"],
  "premier sports": ["premier sports"],
  florugby: ["florugby", "flo rugby"],
};

function patternsFor(broadcast: string): string[] {
  const norm = normalizeChannel(broadcast).trim().replace(/\blocal\b/g, "").trim();
  for (const [key, list] of Object.entries(ALIASES)) if (norm === key || norm.startsWith(`${key} `)) return list;
  return norm ? [norm] : [];
}

const has = (hay: string, phrase: string) => hay.includes(` ${phrase} `);

/** Rank playlist channels likely to carry the game; strongest first, max 10. */
export function suggestChannels(game: GameInfo, channels: CatalogItem[], max = 10): CatalogItem[] {
  const networks = game.broadcasts.map(patternsFor).filter((p) => p.length);
  const teams = game.teams.map((t) => normalizeChannel(t).trim()).filter((t) => t.length >= 4);
  const league = normalizeChannel(game.league).trim();
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of channels) {
    const n = normalizeChannel(item.name);
    let score = 0;
    networks.forEach((list, i) => { if (list.some((p) => has(n, p))) score = Math.max(score, 30 - i); });
    if (teams.some((t) => has(n, t))) score = Math.max(score, 20);
    if (!score && league && has(n, league)) score = 5;
    if (!score && league === "rugby" && has(n, "rugby")) score = 5;
    if (score) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, max).map((s) => s.item);
}
