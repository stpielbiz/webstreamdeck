import { createFileRoute } from "@tanstack/react-router";

/**
 * Media proxy. The signed token carries the upstream URL, so provider
 * credentials never reach the browser and CORS is satisfied same-origin.
 * HLS manifests are rewritten so every segment also flows through here.
 */
export const Route = createFileRoute("/api/public/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      HEAD: async ({ request }) => handle(request),
    },
  },
});

const MANIFEST_HINTS = ["mpegurl", "m3u8", "x-mpegurl"];

/** Equivalent forms of an Xtream stream URL, tried when the first one is refused. */
function alternates(url: string): string[] {
  const match = /^(.*?)(\.[a-z0-9]{2,5})?(\?.*)?$/i.exec(url);
  if (!match) return [];
  const [, stem, ext = "", query = ""] = match;
  const exts = [".m3u8", ".ts", ".mp4", ".mkv", ""];
  return exts.filter((value) => value !== ext.toLowerCase()).map((value) => `${stem}${value}${query}`);
}

async function handle(request: Request): Promise<Response> {
  const { verifyStreamToken, signStreamToken } = await import("@/lib/stream-token.server");
  const { providerFetch } = await import("@/lib/iptv.server");

  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token) return new Response("Missing token", { status: 400 });

  const payload = await verifyStreamToken(token);
  if (!payload) return new Response("Link expired", { status: 403 });

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  // Some providers only serve one of these shapes for a given line, and answer
  // 4xx (often 407) on the others. Try the alternates before giving up.
  const candidates = [payload.u, ...alternates(payload.u)];

  let upstream: Response | null = null;
  let lastStatus = 0;
  for (const candidate of candidates) {
    try {
      const attempt = await providerFetch(candidate, { method: request.method, headers });
      if (attempt.ok || attempt.status === 206) {
        upstream = attempt;
        payload.u = candidate;
        break;
      }
      lastStatus = attempt.status;
      await attempt.body?.cancel();
    } catch {
      lastStatus = 0;
    }
  }

  if (!upstream) {
    const message =
      lastStatus === 407 || lastStatus === 401 || lastStatus === 403
        ? "Your provider refused this stream. This usually means the line is already in use on another device, or it is not allowed from this network."
        : lastStatus
          ? `The provider returned ${lastStatus}`
          : "The provider could not be reached";
    return new Response(message, { status: 502 });
  }

  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const finalUrl = upstream.url || payload.u;
  const isManifest =
    MANIFEST_HINTS.some((hint) => contentType.includes(hint)) ||
    /\.m3u8(\?|$)/i.test(finalUrl.split("?")[0]!);

  if (isManifest) {
    const body = await upstream.text();
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 4;

    const rewriteTarget = async (target: string) => {
      const absolute = new URL(target, finalUrl).toString();
      const signed = await signStreamToken({ p: payload.p, u: absolute, e: expiry });
      return `/api/public/stream?t=${encodeURIComponent(signed)}`;
    };

    const lines = body.split(/\r?\n/);
    const rewritten: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        rewritten.push(line);
        continue;
      }
      if (trimmed.startsWith("#")) {
        const uriMatch = /URI="([^"]+)"/.exec(trimmed);
        if (uriMatch) {
          rewritten.push(trimmed.replace(uriMatch[1]!, await rewriteTarget(uriMatch[1]!)));
        } else {
          rewritten.push(line);
        }
        continue;
      }
      rewritten.push(await rewriteTarget(trimmed));
    }

    return new Response(rewritten.join("\n"), {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
      },
    });
  }

  const passthrough = new Headers();
  for (const header of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
  ]) {
    const value = upstream.headers.get(header);
    if (value) passthrough.set(header, value);
  }
  passthrough.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}
