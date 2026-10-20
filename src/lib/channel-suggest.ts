/** Browser-safe matching of broadcaster names to playlist channel names. */
import type { CatalogItem } from "@/lib/iptv-types";

export type GameInfo = {
  matchup: string;
  startsAt: string;
  league: string;
  teams: string[];
  broadcasts: string[];
  logos?: string[];
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
  // Specific feeds: an exact listing only matches that feed.
  "sportsnet one": ["sportsnet one", "sn one", "sn1", "sn 1"],
  "sportsnet east": ["sportsnet east", "sn east"],
  "sportsnet ontario": ["sportsnet ontario", "sn ontario"],
  "sportsnet pacific": ["sportsnet pacific", "sn pacific"],
  "sportsnet west": ["sportsnet west", "sn west"],
  "sportsnet 360": ["sportsnet 360", "sn360", "sn 360"],
  "sportsnet plus": ["sportsnet plus", "sn plus"],
  "tva sports 2": ["tva sports 2", "tvasports 2"],
  "rds 2": ["rds 2", "rds2"],
  ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`tsn ${n}`, [`tsn ${n}`, `tsn${n}`]])),
};

function patternsFor(broadcast: string): string[] {
  const norm = normalizeChannel(broadcast).trim().replace(/\blocal\b/g, "").trim();
  if (ALIASES[norm]) return ALIASES[norm]!;
  for (const [key, list] of Object.entries(ALIASES)) if (norm.startsWith(`${key} `)) return list;
  return norm ? [norm] : [];
}

const has = (hay: string, phrase: string) => hay.includes(` ${phrase} `);

/** Cleaned names computed once per channel list (by identity) and reused for every game. */
const prepared = new WeakMap<CatalogItem[], string[]>();
function namesOf(channels: CatalogItem[]): string[] {
  let names = prepared.get(channels);
  if (!names) { names = channels.map((c) => normalizeChannel(c.name)); prepared.set(channels, names); }
  return names;
}

/** Numbered event feeds ("ESPN+ 005", "PPV 12") rarely carry the actual game. */
const EVENT_FEED = / (espn plus|ppv|event|events|dazn|flo) ?\d{1,4} /;
const isEventFeed = (n: string) => EVENT_FEED.test(n);

export type NetworkChannels = { network: string; items: CatalogItem[] };

/** Matching playlist channels grouped per listed network (real channels before event feeds). */
export function channelsByNetwork(game: GameInfo, channels: CatalogItem[], max = 16): NetworkChannels[] {
  const names = namesOf(channels);
  return game.broadcasts.map((network) => {
    const pats = patternsFor(network);
    const hits: { item: CatalogItem; ev: number }[] = [];
    if (pats.length) for (let i = 0; i < channels.length; i++) { const n = names[i]!; if (pats.some((p) => has(n, p))) hits.push({ item: channels[i]!, ev: isEventFeed(n) ? 1 : 0 }); }
    hits.sort((a, b) => a.ev - b.ev || a.item.name.localeCompare(b.item.name));
    return { network, items: hits.slice(0, max).map((s) => s.item) };
  });
}

/** Round-robin mix across already-computed network groups, then team/league matches. */
export function suggestChannels(game: GameInfo, channels: CatalogItem[], max = 10, groups = channelsByNetwork(game, channels, max)): CatalogItem[] {
  const names = namesOf(channels);
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  const push = (c: CatalogItem) => { if (!seen.has(c.id) && out.length < max) { seen.add(c.id); out.push(c); } };
  for (let i = 0; out.length < max && groups.some((g) => g.items[i]); i++) for (const g of groups) { const c = g.items[i]; if (c) push(c); }
  if (out.length >= max) return out;
  const teams = game.teams.map((t) => normalizeChannel(t).trim()).filter((t) => t.length >= 4);
  const league = normalizeChannel(game.league).trim();
  const teamHits: CatalogItem[] = [];
  const leagueHits: CatalogItem[] = [];
  for (let i = 0; i < channels.length; i++) {
    const n = names[i]!;
    if (teams.some((t) => has(n, t))) teamHits.push(channels[i]!);
    else if ((!!league && has(n, league)) || (league === "rugby" && has(n, "rugby"))) leagueHits.push(channels[i]!);
  }
  teamHits.sort((a, b) => a.name.localeCompare(b.name)).forEach(push);
  leagueHits.sort((a, b) => a.name.localeCompare(b.name)).forEach(push);
  return out;
}
