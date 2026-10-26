import { describe, expect, it } from "vitest";
import { isEarlierEpisode } from "./episode-order";

describe("isEarlierEpisode", () => {
  it("earlier episode in the same season counts", () => expect(isEarlierEpisode({ season: 1, episode: 3 }, { season: 1, episode: 4 })).toBe(true));
  it("any episode of an earlier season counts", () => expect(isEarlierEpisode({ season: 1, episode: 9 }, { season: 2, episode: 1 })).toBe(true));
  it("the same episode does not count", () => expect(isEarlierEpisode({ season: 2, episode: 1 }, { season: 2, episode: 1 })).toBe(false));
  it("later episodes never count", () => expect(isEarlierEpisode({ season: 2, episode: 2 }, { season: 2, episode: 1 })).toBe(false));
});
