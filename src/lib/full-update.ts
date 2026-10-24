/** "Run a full update" reminder timing, stored per device and playlist. */
export const FULL_UPDATE_DAYS = 7;
export const SNOOZE_DAYS = 3;
const DAY = 86_400_000;

export type FullUpdateRecord = { lastAt?: number; snoozeUntil?: number };

/** True when this device should be reminded to run a full update. */
export function needsFullUpdate(rec: FullUpdateRecord, now = Date.now()): boolean {
  if (rec.snoozeUntil && now < rec.snoozeUntil) return false;
  if (!rec.lastAt) return true;
  return now - rec.lastAt > FULL_UPDATE_DAYS * DAY;
}

export const snoozeTime = (now = Date.now()) => now + SNOOZE_DAYS * DAY;

const key = (playlistId: string) => `streamdeck.fullUpdate.${playlistId}`;
export function readFullUpdate(playlistId: string): FullUpdateRecord {
  try { return JSON.parse(localStorage.getItem(key(playlistId)) ?? "{}") as FullUpdateRecord; } catch { return {}; }
}
export function writeFullUpdate(playlistId: string, rec: FullUpdateRecord) {
  try { localStorage.setItem(key(playlistId), JSON.stringify(rec)); } catch { /* storage unavailable */ }
}
