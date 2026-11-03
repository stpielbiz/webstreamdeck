import { describe, expect, test } from "bun:test";
import { suggestChannels } from "./channel-suggest";

const ch = (name) => ({ id: name, name, image: null, categoryId: null });
const game = { matchup: "Canadiens at Bruins", startsAt: "", league: "NHL", teams: ["Montreal Canadiens", "Canadiens"], broadcasts: ["Sportsnet", "TVA Sports"] };

describe("game channel suggestions", () => {
  test("matches provider spellings of the broadcasters", () => {
    const names = suggestChannels(game, [ch("CA: Sportsnet East HD"), ch("FR | TVA Sports FHD"), ch("CNN")]).map((c) => c.name);
    expect(names).toEqual(["CA: Sportsnet East HD", "FR | TVA Sports FHD"]);
  });
  test("does not match unrelated words", () => {
    expect(suggestChannels(game, [ch("Sports Bar TV"), ch("TVA Nouvelles")])).toEqual([]);
  });
  test("falls back to team then league names", () => {
    const names = suggestChannels({ ...game, broadcasts: [] }, [ch("NHL Center Ice 3"), ch("Canadiens TV")]).map((c) => c.name);
    expect(names).toEqual(["Canadiens TV", "NHL Center Ice 3"]);
  });
  test("rugby: Springboks game finds SuperSport and Sky Sport channels", () => {
    const rugby = { matchup: "South Africa vs New Zealand", startsAt: "", league: "Rugby", teams: ["South Africa"], broadcasts: ["SuperSport", "Sky Sport"] };
    const names = suggestChannels(rugby, [ch("ZA: SS Rugby HD"), ch("NZ | Sky Sport 1"), ch("Rugby Pass"), ch("CNN")]).map((c) => c.name);
    expect(names).toEqual(["ZA: SS Rugby HD", "NZ | Sky Sport 1", "Rugby Pass"]);
  });
});

import { channelsByNetwork as byNet, suggestChannels as sugg } from "./channel-suggest";
test("mix shows every network and demotes ESPN+ event feeds", () => {
  const ch = ["US (ESPN+ 001) | Football", "US (ESPN+ 002) | Golf", "CA: Sportsnet East HD", "CA: TSN 1", "CA: RDS"].map((name, i) => ({ id: String(i), name }));
  const game = { matchup: "x", startsAt: "", league: "NHL", teams: [], broadcasts: ["ESPN+", "Sportsnet", "RDS", "TSN"] };
  const names = sugg(game, ch, 4).map((c) => c.name);
  expect(names).toContain("CA: Sportsnet East HD");
  expect(names).toContain("CA: TSN 1");
  expect(names).toContain("CA: RDS");
  expect(byNet(game, ch).find((g) => g.network === "Sportsnet").items.map((c) => c.name)).toEqual(["CA: Sportsnet East HD"]);
});

test("an exact feed listing (TSN 2) does not pull other TSN feeds", () => {
  const ch = ["CA: TSN 1", "CA: TSN 2 HD", "CA: TSN3", "CA: Sportsnet East"].map((name, i) => ({ id: String(i), name }));
  const g = { matchup: "x", startsAt: "", league: "NHL", teams: [], broadcasts: ["TSN 2"] };
  expect(byNet(g, ch).find((x) => x.network === "TSN 2").items.map((c) => c.name)).toEqual(["CA: TSN 2 HD"]);
});

test("team-named feeds come first; NHL Network always offered", () => {
  const ch = ["NHL 05: Maple Leafs vs Sharks", "Kings TV", "CA: NHL Network HD", "CA: Sportsnet East"].map((name, i) => ({ id: String(i), name }));
  const g = { matchup: "x", startsAt: "", league: "NHL", teams: ["Toronto Maple Leafs", "Maple Leafs", "San Jose Sharks", "Sharks"], broadcasts: ["Sportsnet"] };
  const groups = byNet(g, ch);
  expect(groups[0]).toEqual({ network: "This game", items: [ch[0]] });
  expect(groups.find((x) => x.network === "NHL Network").items).toEqual([ch[2]]);
  expect(sugg(g, ch)[0].name).toBe("NHL 05: Maple Leafs vs Sharks");
  const kings = { ...g, teams: ["Los Angeles Kings", "Kings", "San Jose Sharks", "Sharks"] };
  expect(byNet(kings, ch)[0].items.map((c) => c.name)).not.toContain("Kings TV");
});

describe("NFL channels", () => {
  const nfl = { matchup: "Cowboys at Giants", startsAt: "2026-11-08T18:00:00Z", league: "NFL", teams: ["Dallas Cowboys", "Cowboys", "New York Giants", "Giants"], broadcasts: ["FOX"] };
  const list = ["US: FOX News", "US: FOX Business", "US: FOX 5 New York WNYW", "US: FOX 4 Dallas KDFW", "US: FOX 13 Seattle", "CA: TSN 1", "US: NFL RedZone", "US: ESPN+ 004", "US: ESPN"].map((name) => ({ id: name, name }));
  const groups = byNet(nfl, list);
  const of = (n) => groups.find((g) => g.network === n)?.items.map((c) => c.name) ?? [];
  test("FOX News never matches a FOX game", () => expect(of("FOX")).not.toContain("US: FOX News"));
  test("home-market stations rank first", () => {
    expect(groups[0].network).toBe("Local to Cowboys / Giants");
    expect(of("FOX").slice(0, 2)).toEqual(["US: FOX 4 Dallas KDFW", "US: FOX 5 New York WNYW"]);
  });
  test("Canadian TSN appears only as likely", () => expect(of("Canada (likely)")).toEqual(["CA: TSN 1"]));
  test("Sunday afternoon adds RedZone", () => expect(of("NFL RedZone")).toEqual(["US: NFL RedZone"]));
  test("Monday ESPN game skips ESPN+ event feeds", () => {
    const mon = byNet({ ...nfl, startsAt: "2026-11-10T01:15:00Z", broadcasts: ["ESPN"] }, list);
    expect(mon.find((g) => g.network === "ESPN").items.map((c) => c.name)).toEqual(["US: ESPN"]);
  });
});
