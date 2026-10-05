/**
 * Helpers for handing a stream to a player outside the browser: the Stream Deck
 * Android TV app's built-in player (via its JS bridge) or VLC / MX Player.
 * These play over the device's own connection, which providers that block
 * servers (or that only serve plain http) still allow.
 */

export interface NativePlayRequest {
  url: string;
  title: string;
  live: boolean;
  startPosition: number;
}

interface StreamDeckNativeBridge {
  play: (json: string) => void;
  checkForUpdates?: () => void;
}

declare global {
  interface Window {
    StreamDeckNative?: StreamDeckNativeBridge;
    __streamDeckProgress?: ((position: number, duration: number) => void) | undefined;
    __streamDeckEnded?: (() => void) | undefined;
  }
}

export function hasNativePlayer(): boolean {
  return typeof window !== "undefined" && typeof window.StreamDeckNative?.play === "function";
}

export function playNative(request: NativePlayRequest): boolean {
  if (!hasNativePlayer()) return false;
  window.StreamDeckNative!.play(JSON.stringify(request));
  return true;
}

export type DeviceFamily = "android" | "apple" | "other";

export function deviceFamily(): DeviceFamily {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Android|Silk|AFT[A-Z]/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return "apple";
  return "other";
}

function androidIntent(url: string, pkg: string): string {
  const match = /^(https?):\/\/(.*)$/i.exec(url);
  if (!match) return url;
  const [, scheme, rest] = match;
  return `intent://${rest}#Intent;scheme=${scheme!.toLowerCase()};type=video/*;package=${pkg};end`;
}

export interface ExternalPlayerLink {
  label: string;
  href: string;
}

export function externalPlayerLinks(url: string): ExternalPlayerLink[] {
  const family = deviceFamily();
  if (family === "android") {
    return [
      { label: "Play in VLC", href: androidIntent(url, "org.videolan.vlc") },
      { label: "Play in MX Player", href: androidIntent(url, "com.mxtech.videoplayer.ad") },
    ];
  }
  if (family === "apple") {
    return [{ label: "Play in VLC", href: `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}` }];
  }
  return [{ label: "Play in VLC", href: `vlc://${url}` }];
}
