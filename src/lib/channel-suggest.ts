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
  "nba tv": ["nba tv"],
  "nfl network": ["nfl network"],
  "mlb network": ["mlb network"],
  "espn plus": ["espn plus"],
  espn: ["espn"],
  "prime video": ["prime video", "amazon prime"],
  tnt: ["tnt"],
  msg: ["msg"],
  "fox": ["fox"],
  cbs: ["cbs"],
  nbc: ["nbc"],
  abc: ["abc"],
  espn2: ["espn2", "espn 2"],
  netflix: ["netflix"],
  peacock: ["peacock"],
  ctv: ["ctv"],
  "nfl redzone": ["nfl redzone", "redzone", "red zone"],
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

export const THIS_GAME = "This game";
const LEAGUE_NETWORK: Record<string, string> = { NHL: "NHL Network", NBA: "NBA TV", NFL: "NFL Network", MLB: "MLB Network" };
const FEED_MARK = / (nhl|nba|nfl|mlb|mls|vs|v|at|game|live) /;

/** Channels named after a team playing (e.g. "NHL 05: Maple Leafs vs Sharks"). */
export function gameFeedChannels(game: GameInfo, channels: CatalogItem[], max = 16): CatalogItem[] {
  const names = namesOf(channels);
  // teams arrive as [displayName, nickname] pairs.
  const full: string[] = [];
  const nick: string[] = [];
  game.teams.forEach((t, i) => { const n = normalizeChannel(t).trim(); if (n.length >= 3) (i % 2 === 0 ? full : nick).push(n); });
  const out: CatalogItem[] = [];
  for (let i = 0; i < channels.length && out.length < max; i++) {
    const n = names[i]!.replace(/@/g, " at ");
    if (full.some((t) => has(n, t))) { out.push(channels[i]!); continue; }
    const hits = nick.filter((t) => has(n, t)).length;
    if (hits >= 2 || (hits === 1 && (FEED_MARK.test(n) || channels[i]!.name.includes("@")))) out.push(channels[i]!);
  }
  return out;
}

/** NFL team nickname -> market words and local station call letters. */
const NFL_MARKETS: Record<string, string[]> = {
  cardinals: ["phoenix", "arizona", "kpho", "ksaz", "kpnx", "knxv"], falcons: ["atlanta", "wgcl", "wagatv", "waga", "wxia", "wsb"],
  ravens: ["baltimore", "wjz", "wbff", "wbal", "wmar"], bills: ["buffalo", "wivb", "wutv", "wgrz", "wkbw"],
  panthers: ["charlotte", "wbtv", "wjzy", "wcnc", "wsoc"], bears: ["chicago", "wbbm", "wfld", "wmaq", "wls"],
  bengals: ["cincinnati", "wkrc", "wxix", "wlwt", "wcpo"], browns: ["cleveland", "wois", "wjw", "wkyc", "wews"],
  cowboys: ["dallas", "fort worth", "ktvt", "kdfw", "kxas", "wfaa"], broncos: ["denver", "kcnc", "kdvr", "kusa", "kmgh"],
  lions: ["detroit", "wwj", "wjbk", "wdiv", "wxyz"], packers: ["green bay", "milwaukee", "wfrv", "wluk", "wtmj", "wisn", "witi", "wdjt"],
  texans: ["houston", "khou", "kriv", "kprc", "ktrk"], colts: ["indianapolis", "wttv", "wxin", "wthr", "wrtv"],
  jaguars: ["jacksonville", "wjax", "wfox", "wtlv", "wjxx"], chiefs: ["kansas city", "kctv", "wdaf", "kshb", "kmbc"],
  raiders: ["las vegas", "klas", "kvvu", "ksnv", "ktnv"], chargers: ["los angeles", "kcbs", "kttv", "knbc", "kabc"],
  rams: ["los angeles", "kcbs", "kttv", "knbc", "kabc"], dolphins: ["miami", "wfor", "wsvn", "wtvj", "wplg"],
  vikings: ["minneapolis", "minnesota", "wcco", "kmsp", "kare", "kstp"], patriots: ["boston", "new england", "wbz", "wfxt", "wbts", "wcvb"],
  saints: ["new orleans", "wwl", "wvue", "wdsu", "wgno"], giants: ["new york", "wcbs", "wnyw", "wnbc", "wabc"],
  jets: ["new york", "wcbs", "wnyw", "wnbc", "wabc"], eagles: ["philadelphia", "kyw", "wtxf", "wcau", "wpvi"],
  steelers: ["pittsburgh", "kdka", "wpgh", "wpxi", "wtae"], "49ers": ["san francisco", "bay area", "kpix", "ktvu", "kntv", "kgo"],
  seahawks: ["seattle", "kiro", "kcpq", "king", "komo"], buccaneers: ["tampa", "wtog", "wtvt", "wfla", "wfts"],
  titans: ["nashville", "wtvf", "wztv", "wsmv", "wkrn"], commanders: ["washington", "wusa", "wttg", "wrc", "wjla"],
};
const BROADCAST = new Set(["cbs", "fox", "nbc", "abc"]);
/** Same brand, not the game: news, business and sister cable channels. */
const NOT_GAME = / (news|business|msnbc|sports|soccer|deportes|comedy|life|kids|movies|classic|family|weather|nation|now|fx|fxx|reality|crime|drama|food|kitchen|soul|e) /;
export const CANADA_LIKELY = "Canada (likely)";
export const NFL_REDZONE = "NFL RedZone";

function nflNetworks(game: GameInfo, channels: CatalogItem[], names: string[], max: number): NetworkChannels[] {
  const nicks = game.teams.filter((_, i) => i % 2 === 1).map((t) => normalizeChannel(t).trim());
  const markets = nicks.map((n) => ({ team: n, words: NFL_MARKETS[n] ?? [] }));
  const isLocal = (n: string) => markets.some((m) => m.words.some((w) => has(n, w)));
  const nets = [...new Set(game.broadcasts)];
  if (!nets.some((b) => normalizeChannel(b).trim() === "nfl network")) nets.push("NFL Network");
  const match = (network: string) => {
    const key = normalizeChannel(network).trim();
    const pats = patternsFor(network);
    const out: { item: CatalogItem; rank: number }[] = [];
    for (let i = 0; i < channels.length; i++) {
      const n = names[i]!;
      if (!pats.some((p) => has(n, p))) continue;
      if (BROADCAST.has(key) && NOT_GAME.test(n)) continue;
      if (key === "espn" && (has(n, "espn plus") || has(n, "espn deportes") || has(n, "espnews"))) continue;
      out.push({ item: channels[i]!, rank: isEventFeed(n) ? 2 : BROADCAST.has(key) && isLocal(n) ? 0 : 1 });
    }
    return out.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
  };
  const groups: NetworkChannels[] = [];
  const local: CatalogItem[] = [];
  for (const network of nets) {
    const hits = match(network);
    hits.filter((h) => h.rank === 0).forEach((h) => local.push(h.item));
    groups.push({ network, items: hits.slice(0, max).map((h) => h.item) });
  }
  const start = new Date(game.startsAt);
  if (start.getUTCDay() === 0 && start.getUTCHours() < 23) groups.push({ network: NFL_REDZONE, items: match("NFL RedZone").slice(0, max).map((h) => h.item) });
  const ca = ["TSN", "CTV", "RDS"].flatMap((n) => match(n).map((h) => h.item));
  groups.push({ network: CANADA_LIKELY, items: [...new Map(ca.map((c) => [c.id, c])).values()].slice(0, max) });
  const nick = game.teams[1] ?? game.teams[0] ?? "";
  if (local.length) groups.unshift({ network: `Local to ${markets.filter((m) => m.words.length).map((m) => m.team.replace(/\b\w/g, (c) => c.toUpperCase())).join(" / ") || nick}`, items: local.slice(0, max) });
  return groups;
}

/** Matching playlist channels grouped per listed network (real channels before event feeds). */
export function channelsByNetwork(game: GameInfo, channels: CatalogItem[], max = 16): NetworkChannels[] {
  const names = namesOf(channels);
  if (game.league === "NFL") {
    const feeds = gameFeedChannels(game, channels, max);
    const groups = nflNetworks(game, channels, names, max);
    return feeds.length ? [{ network: THIS_GAME, items: feeds }, ...groups] : groups;
  }
  const nets = [...game.broadcasts];
  const leagueNet = LEAGUE_NETWORK[game.league];
  if (leagueNet && !nets.some((b) => normalizeChannel(b) === normalizeChannel(leagueNet))) nets.unshift(leagueNet);
  const groups = nets.map((network) => {
    const pats = patternsFor(network);
    const hits: { item: CatalogItem; ev: number }[] = [];
    if (pats.length) for (let i = 0; i < channels.length; i++) { const n = names[i]!; if (pats.some((p) => has(n, p))) hits.push({ item: channels[i]!, ev: isEventFeed(n) ? 1 : 0 }); }
    hits.sort((a, b) => a.ev - b.ev || a.item.name.localeCompare(b.item.name));
    return { network, items: hits.slice(0, max).map((s) => s.item) };
  });
  const feeds = gameFeedChannels(game, channels, max);
  return feeds.length ? [{ network: THIS_GAME, items: feeds }, ...groups] : groups;
}

/** Round-robin mix across already-computed network groups, then team/league matches. */
export function suggestChannels(game: GameInfo, channels: CatalogItem[], max = 10, groups = channelsByNetwork(game, channels, max)): CatalogItem[] {
  const names = namesOf(channels);
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  const push = (c: CatalogItem) => { if (!seen.has(c.id) && out.length < max) { seen.add(c.id); out.push(c); } };
  groups.filter((g) => g.network === THIS_GAME).forEach((g) => g.items.forEach(push));
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
