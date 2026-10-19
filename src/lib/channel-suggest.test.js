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
});
