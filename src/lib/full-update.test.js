import { describe, expect, test } from "bun:test";
import { needsFullUpdate, snoozeTime } from "./full-update";

const DAY = 86_400_000;
const now = 1_000 * DAY;

describe("full update reminder", () => {
  test("shows when never updated", () => expect(needsFullUpdate({}, now)).toBe(true));
  test("hidden 6 days after an update", () => expect(needsFullUpdate({ lastAt: now - 6 * DAY }, now)).toBe(false));
  test("shows 8 days after an update", () => expect(needsFullUpdate({ lastAt: now - 8 * DAY }, now)).toBe(true));
  test("Later hides it for 3 days", () => {
    const snoozeUntil = snoozeTime(now);
    expect(needsFullUpdate({ snoozeUntil }, now + 2 * DAY)).toBe(false);
    expect(needsFullUpdate({ snoozeUntil }, now + 4 * DAY)).toBe(true);
  });
});
