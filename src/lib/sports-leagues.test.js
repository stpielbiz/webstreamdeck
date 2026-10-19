import { describe, expect, test } from "bun:test";
import { gameStatusLabel, visibleGames } from "./sports-leagues";

const g = (state, startsAt) => ({ id: startsAt, matchup: "A at B", startsAt, state, detail: "", endedAt: null, teams: [], broadcasts: [] });

describe("sports guide labels", () => {
  test("later game shows its start time", () => {
    expect(gameStatusLabel(g("pre", "2026-10-19T23:00:00Z"), "en-US")).toMatch(/\d{1,2}:00/);
  });
  test("live game shows In progress, finished shows Final", () => {
    expect(gameStatusLabel(g("in", "2026-10-19T23:00:00Z"))).toBe("In progress");
    expect(gameStatusLabel(g("post", "2026-10-19T23:00:00Z"))).toBe("Final");
  });
  test("finished games drop off 2 hours after they end", () => {
    const start = Date.parse("2026-10-19T18:00:00Z");
    const games = [g("post", "2026-10-19T18:00:00Z"), g("pre", "2026-10-19T23:00:00Z")];
    expect(visibleGames(games, start + 4 * 3600_000)).toHaveLength(2);
    expect(visibleGames(games, start + 5.5 * 3600_000)).toHaveLength(1);
  });
});
