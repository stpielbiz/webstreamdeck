import type { CatalogItem } from "./iptv-types";

export interface GroupingMetadata {
  title?: string | null;
  year?: string | number | null;
}

export interface TitleVariant {
  item: CatalogItem;
  label: string;
  tags: string[];
  qualityRank: number;
}

export interface TitleGroup {
  key: string;
  item: CatalogItem;
  variants: TitleVariant[];
  title: string;
  year: string | number | null;
}

const QUALITY_TAGS: { pattern: RegExp; label: string; rank: number }[] = [
  { pattern: /\b(4k|2160p)\b/i, label: "4K", rank: 5 },
  { pattern: /\buhd\b/i, label: "UHD", rank: 5 },
  { pattern: /\b(fhd|1080p)\b/i, label: "FHD", rank: 4 },
  { pattern: /\b(720p|hd)\b/i, label: "HD", rank: 3 },
  { pattern: /\b(sd|576p|480p)\b/i, label: "SD", rank: 2 },
];

const DETAIL_TAGS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(hevc|h[ .]?265|x265)\b/i, label: "HEVC" },
  { pattern: /\b(h[ .]?264|x264|avc)\b/i, label: "H.264" },
  { pattern: /\bimax\b/i, label: "IMAX" },
  { pattern: /\bremux\b/i, label: "Remux" },
  { pattern: /\bweb[ ._-]?dl\b/i, label: "WEB-DL" },
  { pattern: /\bblu[ ._-]?ray\b/i, label: "Blu-ray" },
  { pattern: /\b(multi|multisub)\b/i, label: "Multi" },
  { pattern: /\b(vostfr)\b/i, label: "VOSTFR" },
  { pattern: /\b(dubbed|dub)\b/i, label: "Dubbed" },
  { pattern: /\b(english|eng|en)\b/i, label: "English" },
  { pattern: /\b(french|fra|fre|fr)\b/i, label: "French" },
  { pattern: /\b(spanish|spa|es)\b/i, label: "Spanish" },
  { pattern: /\b(german|deu|ger|de)\b/i, label: "German" },
  { pattern: /\b(italian|ita|it)\b/i, label: "Italian" },
  { pattern: /\b(portuguese|por|pt)\b/i, label: "Portuguese" },
];

const DECORATION_WORDS = /\b(4k|2160p|uhd|fhd|1080p|720p|hd|sd|576p|480p|hevc|h[ .]?265|x265|h[ .]?264|x264|avc|imax|remux|web[ ._-]?dl|blu[ ._-]?ray|multi|multisub|vostfr|dubbed|dub|english|eng|en|french|fra|fre|fr|spanish|spa|es|german|deu|ger|de|italian|ita|it|portuguese|por|pt)\b/gi;

function extractYear(raw: string): number | null {
  const matches = raw.match(/\b(?:19|20)\d{2}\b/g);
  const value = matches?.at(-1);
  return value ? Number(value) : null;
}

/** Provider-safe title cleanup used only for grouping and display. */
export function cleanVariantTitle(raw: string): string {
  return raw
    .replace(/\.(mp4|mkv|avi|ts)$/i, "")
    .replace(/^\s*[[(|]?[A-Za-z]{2,4}[\])|]?\s*[-–|:]\s*/, " ")
    .replace(DECORATION_WORDS, " ")
    .replace(/[[(]\s*[\])]/g, " ")
    .replace(/[[(][\s._|:/-]*[\])]/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/[\s._|:/-]+$/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim() || raw.trim();
}

export function titleMatchKey(raw: string): string {
  return cleanVariantTitle(raw)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tagsFor(name: string) {
  const tags: string[] = [];
  let qualityRank = 1;
  for (const tag of QUALITY_TAGS) {
    if (!tag.pattern.test(name)) continue;
    tags.push(tag.label);
    qualityRank = Math.max(qualityRank, tag.rank);
  }
  for (const tag of DETAIL_TAGS) if (tag.pattern.test(name)) tags.push(tag.label);
  return { tags: [...new Set(tags)], qualityRank };
}

function labelVariants(items: CatalogItem[]): TitleVariant[] {
  const ranked = items
    .map((item, originalIndex) => ({ item, originalIndex, ...tagsFor(item.name) }))
    .sort((a, b) => b.qualityRank - a.qualityRank || a.originalIndex - b.originalIndex);
  const signatures = ranked.map((entry) => entry.tags.join(" · "));
  const distinct = new Set(signatures.filter(Boolean));
  const useLinksOnly = distinct.size <= 1;
  const occurrences = new Map<string, number>();
  return ranked.map((entry, index) => {
    const signature = signatures[index] ?? "";
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    const duplicateCount = signatures.filter((value) => value === signature).length;
    const label = useLinksOnly
      ? `Link ${index + 1}`
      : signature
        ? duplicateCount > 1 ? `${signature} · Link ${occurrence}` : signature
        : `Link ${index + 1}`;
    return { item: entry.item, label, tags: entry.tags, qualityRank: entry.qualityRank };
  });
}

export function groupCatalogItems(
  items: CatalogItem[],
  metadata?: Record<string, GroupingMetadata | undefined>,
): TitleGroup[] {
  const groups = new Map<string, { items: CatalogItem[]; title: string; year: string | number | null }>();
  for (const item of items) {
    const meta = metadata?.[item.name];
    const title = meta?.title?.trim() || cleanVariantTitle(item.name);
    const year = meta?.year || item.year || extractYear(item.name);
    const key = `${titleMatchKey(title)}|${year || ""}`;
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { items: [item], title, year });
  }
  return [...groups.entries()].map(([key, group]) => {
    const variants = labelVariants(group.items);
    return { key, item: variants[0]?.item ?? group.items[0]!, variants, title: group.title, year: group.year };
  });
}

export function variantsForItem(
  items: CatalogItem[],
  itemId: string,
  metadata?: Record<string, GroupingMetadata | undefined>,
): TitleVariant[] {
  return groupCatalogItems(items, metadata).find((group) => group.variants.some((variant) => variant.item.id === itemId))?.variants ?? [];
}