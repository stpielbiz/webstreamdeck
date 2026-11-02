import { describe, expect, it } from "vitest";
import { selectResumeEpisode } from "./resume-episode";

const seasons = [
  { season: 1, episodes: [{ id: "first", season: 1, episode: 1 }, { id: "second", season: 1, episode: 2 }] },
  { season: 2, episodes: [{ id: "third", season: 2, episode: 1 }] },
];

describe("Continue Watching episode selection", () => {
  it("starts the clicked episode rather than the first episode", () => {
    expect(selectResumeEpisode(seasons, { itemId: "second" })?.episode.id).toBe("second");
  });
  it("selects the correct season as well as episode", () => {
    expect(selectResumeEpisode(seasons, { itemId: "third" })?.index).toBe(1);
  });
  it("resolves a synced playlist's episode by season and episode", () => {
    expect(selectResumeEpisode(seasons, { itemId: "other-provider-id", season: 2, episode: 1 })?.episode.id).toBe("third");
  });
  it("never starts a different episode when the selected episode is unavailable", () => {
    expect(selectResumeEpisode(seasons, { itemId: "missing", season: 3, episode: 5 })).toBeUndefined();
  });
});