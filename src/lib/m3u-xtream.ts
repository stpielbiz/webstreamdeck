export interface XtreamLogin { serverUrl: string; username: string; password: string }

/** Detects M3U links that are really Xtream Codes logins (get.php?username=&password= or /playlist/user/pass). */
export function parseXtreamFromM3u(raw: string): XtreamLogin | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const server = `${url.protocol}//${url.host}`;
  if (/\/get\.php$/i.test(url.pathname)) {
    const username = url.searchParams.get("username")?.trim();
    const password = url.searchParams.get("password")?.trim();
    return username && password ? { serverUrl: server, username, password } : null;
  }
  const match = url.pathname.match(/^\/playlist\/([^/]+)\/([^/]+)(?:\/[^/]*)?$/i);
  if (match) return { serverUrl: server, username: decodeURIComponent(match[1]), password: decodeURIComponent(match[2]) };
  return null;
}
