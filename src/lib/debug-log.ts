import { useSyncExternalStore } from "react";

/** Opt-in playback diagnostics. Kept on this device and auto-saved to the account while switched on. */
const ENABLED_KEY = "streamdeck.debugLogs";
const ENTRIES_KEY = "streamdeck.debugEntries";
const MAX = 300;
const UPLOAD_EVERY_MS = 20_000;

export type DebugEntry = { at: string; scope: string; message: string; detail?: string };

function loadEntries(): DebugEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ENTRIES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX) : [];
  } catch {
    return [];
  }
}

let enabled = typeof window !== "undefined" && window.localStorage.getItem(ENABLED_KEY) === "1";
// Survive an app restart, so a freeze that needs a relaunch still leaves its trail.
let entries: DebugEntry[] = enabled ? loadEntries() : [];
let dirty = false;
let persistTimer: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function persistSoon() {
  if (typeof window === "undefined" || persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try { window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)); } catch { /* storage full */ }
  }, 500);
}

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

export function isDebugEnabled() {
  return enabled;
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
  dirty = true;
  persistSoon();
  emit();
}

/** Short description of an element for logs (never its text content). */
export function describeElement(element: Element | null | undefined): string {
  if (!element) return "none";
  if (element === document.body) return "body";
  const html = element as HTMLElement;
  const key = html.dataset?.["focusKey"];
  const zone = html.closest<HTMLElement>("[data-tv-zone]")?.dataset["tvZone"];
  return `${element.tagName.toLowerCase()}${key ? `#${key}` : ""}${zone ? ` in ${zone}` : ""}${element.isConnected ? "" : " (removed)"}`;
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
    startAutoUpload();
  } else {
    window.localStorage.removeItem(ENTRIES_KEY);
  }
  emit();
}

export function clearDebugLog() {
  entries = [];
  if (typeof window !== "undefined") window.localStorage.removeItem(ENTRIES_KEY);
  emit();
}

export function formatDebugLog(): string {
  return entries
    .map((e) => `${e.at.slice(11, 23)} [${e.scope}] ${e.message}${e.detail ? ` ${e.detail}` : ""}`)
    .join("\n");
}

/**
 * While logging is on, save a snapshot to the account every 20 s (and when the
 * app goes to the background), so the admin page has the logs even when the
 * screen is too frozen to press Save.
 */
let uploading = false;
let uploadStarted = false;
async function uploadSnapshot() {
  if (!enabled || !dirty || uploading || entries.length === 0) return;
  uploading = true;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    dirty = false;
    const code = "AUTO-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();
    const { error } = await supabase.from("stream_logs").insert({
      code, user_id: data.user.id, device: navigator.userAgent.slice(0, 300), entries: entries as never,
    });
    if (error) dirty = true;
  } catch {
    dirty = true;
  } finally {
    uploading = false;
  }
}

function startAutoUpload() {
  if (uploadStarted || typeof window === "undefined") return;
  uploadStarted = true;
  window.setInterval(() => void uploadSnapshot(), UPLOAD_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void uploadSnapshot();
  });
  // A page that stops responding shows up as a long gap between ticks.
  let last = Date.now();
  window.setInterval(() => {
    const now = Date.now();
    if (now - last > 3000 && document.visibilityState === "visible") debugLog("page", `Page was unresponsive for ${now - last} ms`);
    last = now;
  }, 1000);
  window.addEventListener("focus", () => debugLog("page", "Window focused", describeElement(document.activeElement)));
  window.addEventListener("blur", () => debugLog("page", "Window lost focus"));
  document.addEventListener("visibilitychange", () => debugLog("page", `Page ${document.visibilityState}`));
}

if (enabled && typeof window !== "undefined") startAutoUpload();

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
