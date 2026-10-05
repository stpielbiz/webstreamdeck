import { useSyncExternalStore } from "react";

/** Opt-in playback diagnostics, stored only on this device. */
const ENABLED_KEY = "streamdeck.debugLogs";
const MAX = 300;

export type DebugEntry = { at: string; scope: string; message: string; detail?: string };

let entries: DebugEntry[] = [];
let enabled = typeof window !== "undefined" && window.localStorage.getItem(ENABLED_KEY) === "1";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Hide provider usernames/passwords and tokens before anything is shown or copied. */
export function redactUrl(value: string | null | undefined): string {
  if (!value) return String(value);
  try {
    const url = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://x");
    if (url.pathname.startsWith("/api/public/stream")) return `${url.origin}/api/public/stream?t=…(relay)`;
    const parts = url.pathname.split("/");
    const typed = ["live", "movie", "series", "timeshift"].includes(parts[1] ?? "");
    const masked = parts.map((part, index) => {
      if (typed && (index === 2 || index === 3)) return "***";
      if (!typed && parts.length >= 4 && (index === 1 || index === 2)) return "***";
      return part;
    });
    return `${url.protocol}//${url.host}${masked.join("/")}${url.search ? "?…" : ""}`;
  } catch {
    return "(unreadable url)";
  }
}

export function debugLog(scope: string, message: string, detail?: unknown) {
  if (!enabled) return;
  const entry: DebugEntry = { at: new Date().toISOString(), scope, message };
  if (detail !== undefined) {
    try {
      entry.detail = typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch {
      entry.detail = String(detail);
    }
  }
  entries = [...entries.slice(-(MAX - 1)), entry];
  emit();
}

export function setDebugEnabled(value: boolean) {
  enabled = value;
  window.localStorage.setItem(ENABLED_KEY, value ? "1" : "0");
  if (value) {
    entries = [];
    debugLog("device", "Logging started", {
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      nativeApp: typeof window.StreamDeckNative?.play === "function",
      mse: typeof window.MediaSource !== "undefined",
      nativeHls: document.createElement("video").canPlayType("application/vnd.apple.mpegurl") || "no",
    });
  }
  emit();
}

export function clearDebugLog() {
  entries = [];
  emit();
}

export function formatDebugLog(): string {
  return entries
    .map((e) => `${e.at.slice(11, 23)} [${e.scope}] ${e.message}${e.detail ? ` ${e.detail}` : ""}`)
    .join("\n");
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useDebugLog() {
  const state = useSyncExternalStore(
    subscribe,
    () => (enabled ? entries : null),
    () => null,
  );
  return { enabled: state !== null, entries: state ?? [] };
}
