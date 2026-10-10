/**
 * Browser-safe title normalisation shared with the metadata store.
 * The lookup keys produced here must match `title_metadata.lookup_key`.
 */

const QUALITY_WORDS =
  /\b(4k|uhd|fhd|hd|sd|hevc|x265|x264|multi|multisub|sub|subs|dub|dubbed|vf|vo|vostfr|imax|remux|web[- ]?dl|bluray)\b/gi;

const EPISODE_SUFFIX = /\s*[-–—._|:]?\s*s\d{1,2}\s*[-–—._ ]?e\d{1,3}\b.*$/i;

function usableYear(value: string): number | null {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 2 ? year : null;
}

/** Turn a provider title into a clean title plus a release year, when present. */
export function normalizeTitle(raw: string): { title: string; year: number | null } {
  let text = raw.replace(/\.(mp4|mkv|avi|ts)$/i, "");

  // Leading provider/language prefixes: "EN - ", "NF - ", "AR| ", "[FR] ".
  text = text.replace(/^\s*[[(|]?[A-Za-z]{2,4}[\])|]?\s*[-–|:]\s*/, " ");
  // M3U providers sometimes use an episode as the series catalogue entry.
  // Keep only the series portion: "1923 (2022) - S01-E01 - 1923".
  text = text.replace(EPISODE_SUFFIX, " ");
  text = text.replace(/[[(]\s*[\])]/g, " ");

  let year: number | null = null;
  // A bracketed release year is unambiguous, even when the title itself is a
  // year (for example the show "1923" released in 2022).
  text = text.replace(/[[(]\s*((?:19|20)\d{2})\s*[\])]/g, (match, candidate: string) => {
    const parsed = usableYear(candidate);
    if (parsed !== null) year = parsed;
    return parsed === null ? match : " ";
  });
  // Remove other provider annotations after retaining a possible year.
  text = text.replace(/[[(][^\])]*[\])]/g, " ");
  text = text.replace(QUALITY_WORDS, " ");

  if (year === null) {
    const years = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)];
    const candidate = years.at(-1);
    if (candidate) {
      const withoutCandidate = `${text.slice(0, candidate.index)} ${text.slice((candidate.index ?? 0) + candidate[0].length)}`;
      // A title made only from four digits ("1923", "1917") is not a year.
      if (/[A-Za-z0-9]/.test(withoutCandidate)) {
        year = usableYear(candidate[0]);
        if (year !== null) text = withoutCandidate;
      }
    }
  }

  const title = text
    .replace(/[[(]\s*[\])]/g, " ")
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
