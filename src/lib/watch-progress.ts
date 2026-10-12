import type { ProgressRow } from "@/lib/iptv.functions";
import { mediaMatchKey, type TitleVariant } from "@/lib/title-variants";

/**
 * Fraction (0–1) of the title already watched, or null when not started.
 * Matches progress rows against variant item IDs, series IDs, or the
 * normalised title so cross-playlist copies still line up.
 */
export function progressForVariants(
  rows: ProgressRow[] | undefined,
  playlistId: string | null,
  variants: TitleVariant[],
  title?: string,
): number | null {
  const ids = new Set(variants.map((variant) => variant.item.id));
  const row = (rows ?? []).find(
    (entry) =>
      entry.playlistId === playlistId &&
      (ids.has(entry.itemId) ||
        (entry.seriesId ? ids.has(entry.seriesId) : false) ||
        (!!title && mediaMatchKey(entry.title) === mediaMatchKey(title))) &&
      !entry.completed,
  );
  if (!row) return null;
  return row.durationSeconds ? row.positionSeconds / row.durationSeconds : 0.05;
}

/** True when any matching progress row marks the title as completed. */
export function completedForVariants(
  rows: ProgressRow[] | undefined,
  playlistId: string | null,
  variants: TitleVariant[],
  title?: string,
): boolean {
  const ids = new Set(variants.map((variant) => variant.item.id));
  return (rows ?? []).some(
    (entry) =>
      entry.playlistId === playlistId &&
      entry.completed &&
      (ids.has(entry.itemId) ||
        (entry.seriesId ? ids.has(entry.seriesId) : false) ||
        (!!title && mediaMatchKey(entry.title) === mediaMatchKey(title))),
  );
}
