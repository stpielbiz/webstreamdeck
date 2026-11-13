import { describe, expect, it } from "vitest";
import { nextEpisode, withUpNext } from "./next-episode";

const ep = (id, season, episode) => ({ id, season, episode, title: id });
const seasons = [
  { season: 1, episodes: [ep("a", 1, 1), ep("b", 1, 2)] },
  { season: 2, episodes: [ep("c", 2, 1)] },
];

describe("nextEpisode", () => {
  it("goes to the next episode in the season", () => expect(nextEpisode(seasons, { id: "a" })?.episode.id).toBe("b"));
  it("crosses into the next season", () => expect(nextEpisode(seasons, { id: "b" })).toMatchObject({ index: 1, episode: { id: "c" } }));
  it("has nothing after the last episode", () => expect(nextEpisode(seasons, { id: "c" })).toBeUndefined());
});

const row = (itemId, completed, updatedAt, positionSeconds = 600) => ({
  itemKind: "episode", itemId, seriesId: "show", completed, positionSeconds, external: false, updatedAt,
});

describe("withUpNext", () => {
  it("turns a finished latest episode into an up-next entry", () => {
    const out = withUpNext([row("e2", true, "2026-11-02"), row("e1", true, "2026-11-01")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemId: "e2", upNext: true });
  });
  it("keeps resuming an unfinished latest episode", () => {
    const out = withUpNext([row("e3", false, "2026-11-03"), row("e2", true, "2026-11-02")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemId: "e3" });
    expect(out[0].upNext).toBeUndefined();
  });
});
