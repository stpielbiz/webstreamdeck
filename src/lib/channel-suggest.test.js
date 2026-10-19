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
  expect(byNet(game, ch)[1].items.map((c) => c.name)).toEqual(["CA: Sportsnet East HD"]);
});

test("an exact feed listing (TSN 2) does not pull other TSN feeds", () => {
  const ch = ["CA: TSN 1", "CA: TSN 2 HD", "CA: TSN3", "CA: Sportsnet East"].map((name, i) => ({ id: String(i), name }));
  const g = { matchup: "x", startsAt: "", league: "NHL", teams: [], broadcasts: ["TSN 2"] };
  expect(byNet(g, ch)[0].items.map((c) => c.name)).toEqual(["CA: TSN 2 HD"]);
});
