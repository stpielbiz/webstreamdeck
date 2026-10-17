/** True inside the Fire TV app (native bridge) or a TV-mode screen. */
export function isFireTvDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (window.StreamDeckNative) return true;
  const { pathname, search } = window.location;
  return pathname === "/tv" || pathname.startsWith("/tv/") || new URLSearchParams(search).get("mode") === "tv";
}

export function signedOutPath(): "/tv/pair" | "/auth" {
  return isFireTvDevice() ? "/tv/pair" : "/auth";
}
