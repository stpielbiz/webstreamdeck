import type { Category, CatalogItem } from "@/lib/iptv-types";

/**
 * Providers name their categories in wildly different ways
 * ("VOD | EN - Action 2024", "AR: Horror", "|FR| Documentaires").
 * These helpers turn that noise into tidy genre and year groupings so the
 * library can be browsed like a streaming service.
 */

const GENRES: { label: string; words: string[] }[] = [
  { label: "Action", words: ["action", "adventure", "aventure", "martial"] },
  { label: "Comedy", words: ["comedy", "comedie", "comédie", "sitcom", "stand up", "standup"] },
  { label: "Drama", words: ["drama", "drame", "melodrama"] },
  { label: "Horror", words: ["horror", "terror", "horreur", "slasher"] },
  { label: "Thriller", words: ["thriller", "suspense", "mystery", "crime", "police", "noir"] },
  { label: "Sci-fi & Fantasy", words: ["sci-fi", "scifi", "science fiction", "fantasy", "fantastique"] },
  { label: "Romance", words: ["romance", "romantic", "romantique"] },
  { label: "Family & Kids", words: ["kids", "family", "enfant", "cartoon", "animation", "anime", "disney", "pixar"] },
  { label: "Documentary", words: ["documentary", "documentaire", "docu", "nature", "history", "biography"] },
  { label: "Sports", words: ["sport", "ufc", "wwe", "wrestling", "football", "soccer", "nba", "nfl", "boxing"] },
  { label: "War & Western", words: ["war", "guerre", "western", "military"] },
  { label: "Music & Stage", words: ["music", "musical", "concert", "opera", "theatre", "theater"] },
  { label: "Reality & TV", words: ["reality", "talk show", "game show", "novela", "telenovela"] },
  { label: "Classics", words: ["classic", "classique", "old", "retro", "vintage"] },
  { label: "Christmas & Holiday", words: ["christmas", "holiday", "noel", "noël", "halloween"] },
];

/** Strip provider prefixes, bracketed language tags and separators. */
export function cleanCategoryName(name: string): string {
  return name
    .replace(/[[\](){}|]/g, " ")
    .replace(/\b(vod|movies?|series|tv shows?|4k|hd|fhd|uhd|sd|new|latest)\b/gi, " ")
    .replace(/\b[a-z]{2}\s*[-:]\s*/gi, " ")
    .replace(/[-:_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort genre label for a provider category name. */
export function genreFromCategory(name: string): string {
  const text = cleanCategoryName(name).toLowerCase();
  for (const genre of GENRES) {
    if (genre.words.some((word) => text.includes(word))) return genre.label;
  }
  const label = cleanCategoryName(name).replace(/\d{4}/g, "").replace(/\s+/g, " ").trim();
  return label ? label.replace(/^./, (character) => character.toUpperCase()) : "Other";
}

export type GroupBy = "genre" | "year" | "alphabet";

export interface ItemGroup {
  key: string;
  label: string;
  items: CatalogItem[];
}

function yearLabel(year: string | null | undefined): string {
  const value = Number(String(year ?? "").slice(0, 4));
  if (!Number.isFinite(value) || value < 1900 || value > 2100) return "Year unknown";
  const currentYear = new Date().getFullYear();
  if (value >= currentYear - 1) return `${value} — newest`;
  if (value >= 2020) return "2020s";
  if (value >= 2010) return "2010s";
  if (value >= 2000) return "2000s";
  if (value >= 1990) return "1990s";
  if (value >= 1980) return "1980s";
  return "Before 1980";
}

const YEAR_ORDER = [
  "2020s",
  "2010s",
  "2000s",
  "1990s",
  "1980s",
  "Before 1980",
  "Year unknown",
];

/** Group a catalogue into shelves by genre, release period or first letter. */
export function groupItems(
  items: CatalogItem[],
  categories: Category[],
  groupBy: GroupBy,
): ItemGroup[] {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const buckets = new Map<string, CatalogItem[]>();

  for (const item of items) {
    let label: string;
    if (groupBy === "genre") {
      const categoryName = item.categoryId ? categoryNames.get(item.categoryId) : undefined;
      label = categoryName ? genreFromCategory(categoryName) : "Other";
    } else if (groupBy === "year") {
      label = yearLabel(item.year);
    } else {
      const first = item.name.trim().replace(/^(the|a|an|le|la|les)\s+/i, "").charAt(0).toUpperCase();
      label = /[A-Z]/.test(first) ? first : /[0-9]/.test(first) ? "0–9" : "Other";
    }
    const bucket = buckets.get(label);
    if (bucket) bucket.push(item);
    else buckets.set(label, [item]);
  }

  const groups = [...buckets.entries()].map(([label, groupItems_]) => ({
    key: label,
    label,
    items: groupItems_,
  }));

  if (groupBy === "year") {
    groups.sort((a, b) => {
      const aNewest = a.label.includes("newest");
      const bNewest = b.label.includes("newest");
      if (aNewest !== bNewest) return aNewest ? -1 : 1;
      if (aNewest && bNewest) return b.label.localeCompare(a.label);
      return YEAR_ORDER.indexOf(a.label) - YEAR_ORDER.indexOf(b.label);
    });
  } else if (groupBy === "alphabet") {
    groups.sort((a, b) => a.label.localeCompare(b.label));
    for (const group of groups) group.items.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    groups.sort((a, b) => {
      if (a.label === "Other") return 1;
      if (b.label === "Other") return -1;
      return b.items.length - a.items.length;
    });
  }

  return groups;
}
