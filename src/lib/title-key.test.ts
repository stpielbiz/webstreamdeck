import { describe, expect, test } from "bun:test";

import type { CatalogItem } from "./iptv-types";
import { lookupKeyFor, normalizeTitle } from "./title-key";
import { cleanVariantTitle, groupCatalogItems, mediaMatchKey } from "./title-variants";

describe("provider title cleanup", () => {
  test("keeps a numeric series title and extracts its bracketed release year", () => {
    expect(normalizeTitle("EN - 1923 (2022) - S01-E01 - 1923")).toEqual({ title: "1923", year: 2022 });
    expect(lookupKeyFor("EN - 1923 (2022) - S01-E01 - 1923").key).toBe("1923|2022");
  });

  test("supports compact and separator-based episode markers", () => {
    expect(normalizeTitle("Yellowstone (2018) S01E01 Pilot")).toEqual({ title: "Yellowstone", year: 2018 });
    expect(normalizeTitle("Yellowstone (2018) - S01.E01 - Pilot")).toEqual({ title: "Yellowstone", year: 2018 });
  });

  test("does not mistake a four-digit title for its release year", () => {
    expect(normalizeTitle("1923")).toEqual({ title: "1923", year: null });
    expect(normalizeTitle("1917 (2019)")).toEqual({ title: "1917", year: 2019 });
  });

  test("removes empty parentheses from provider and saved titles", () => {
    expect(cleanVariantTitle("Yellowstone ()")).toBe("Yellowstone");
    const item: CatalogItem = { id: "show-1", name: "Yellowstone ()", image: null, categoryId: null, year: "2018" };
    expect(groupCatalogItems([item], { "Yellowstone ()": { title: "Yellowstone ()", year: 2018 } })[0]).toMatchObject({ title: "Yellowstone", year: 2018 });
  });

  test("groups an episode-formatted entry under its franchise title", () => {
    const item: CatalogItem = { id: "1923-episode", name: "EN - 1923 (2022) - S01-E01 - 1923", image: null, categoryId: null };
    const group = groupCatalogItems([item])[0];
    expect(group).toMatchObject({ title: "1923", year: 2022 });
    expect(mediaMatchKey(group?.title ?? "")).toBe(mediaMatchKey("1923"));
  });
});