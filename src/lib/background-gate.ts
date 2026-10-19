/**
 * Shared "is now a good moment for heavy background work?" signal.
 * Background library work steps aside while the TV app's full-screen player is
 * open, for a while after it closes, and while a remote button is held — so the
 * page always stays responsive to the remote.
 */
const AFTER_PLAYER_MS = 15_000;
const AFTER_KEY_MS = 1_500;

let playerOpen = false;
let playerClosedAt = 0;
let lastKeyAt = 0;
let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", () => { lastKeyAt = Date.now(); }, true);
}

export function markPlayerOpen(open: boolean) {
  install();
  if (playerOpen && !open) playerClosedAt = Date.now();
  playerOpen = open;
}

function nativePlayerOpen(): boolean {
  try {
    return typeof window !== "undefined" && window.StreamDeckNative?.isPlayerOpen?.() === true;
  } catch {
    return false;
  }
}

/** True when heavy background work should wait. */
export function backgroundBusy(): boolean {
  install();
  if (typeof document !== "undefined" && document.hidden) return true;
  if (playerOpen || nativePlayerOpen()) return true;
  const now = Date.now();
  if (now - playerClosedAt < AFTER_PLAYER_MS) return true;
  if (now - lastKeyAt < AFTER_KEY_MS) return true;
  return false;
}

/** Resolves once background work may run (checks every second). */
export async function waitForIdle(isCancelled?: () => boolean): Promise<void> {
  while (backgroundBusy() && !isCancelled?.()) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
}

/** Gives the remote a chance between slices of heavy work. */
export function yieldToPage(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
