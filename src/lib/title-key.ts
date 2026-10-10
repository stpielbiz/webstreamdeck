/**
 * Browser-safe title normalisation shared with the metadata store.
 * The lookup keys produced here must match `title_metadata.lookup_key`.
 */

const QUALITY_WORDS =
  /\b(4k|uhd|fhd|hd|sd|hevc|x265|x264|multi|multisub|sub|subs|dub|dubbed|vf|vo|vostfr|imax|remux|web[- ]?dl|bluray)\b/gi;

/** Turn a provider title into a clean title plus a release year, when present. */
export function normalizeTitle(raw: string): { title: string; year: number | null } {
  let text = raw.replace(/\.(mp4|mkv|avi|ts)$/i, "");

  // Leading provider/language prefixes: "EN - ", "NF - ", "AR| ", "[FR] ".
  text = text.replace(/^\s*[[(|]?[A-Za-z]{2,4}[\])|]?\s*[-–|:]\s*/, " ");
  text = text.replace(/[[(][^\])]*[\])]/g, " ");
  text = text.replace(QUALITY_WORDS, " ");

  const currentYear = new Date().getFullYear();
  let year: number | null = null;
  const years = text.match(/(?:19|20)\d{2}/g);
  if (years) {
    for (const candidate of years) {
      const value = Number(candidate);
      if (value >= 1900 && value <= currentYear + 2) year = value;
    }
    if (year !== null) text = text.replace(new RegExp(`\\b${year}\\b`, "g"), " ");
  }

  const title = text
    .replace(/[-–_|:]+\s*$/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title, year };
}

/** Cache key: normalised lowercase title plus year when known. */
export function lookupKeyFor(raw: string): { key: string; title: string; year: number | null } {
  const { title, year } = normalizeTitle(raw);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return { key: year ? `${slug}|${year}` : slug, title, year };
}
