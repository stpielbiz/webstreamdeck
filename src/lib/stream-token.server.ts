/**
 * Short-lived signed tokens for the media proxy. The token carries the
 * upstream URL so provider credentials never appear in a browser-visible URL.
 */
export interface StreamTokenPayload {
  /** playlist id (used for logging / future per-playlist rules) */
  p: string;
  /** absolute upstream url */
  u: string;
  /** expiry, epoch seconds */
  e: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)!;
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret =
    process.env["STREAM_TOKEN_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    "insecure-dev-secret";
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signStreamToken(payload: StreamTokenPayload): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyStreamToken(token: string): Promise<StreamTokenPayload | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature) as unknown as ArrayBuffer,
      encoder.encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as StreamTokenPayload;
    if (!payload.u || typeof payload.e !== "number" || payload.e * 1000 < Date.now()) return null;
    if (!/^https?:\/\//i.test(payload.u)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Build the same-origin proxy URL the browser player should load. */
export async function proxyUrl(playlistId: string, upstream: string, ttlSeconds = 60 * 60 * 8) {
  const token = await signStreamToken({
    p: playlistId,
    u: upstream,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  return `/api/public/stream?t=${encodeURIComponent(token)}`;
}
