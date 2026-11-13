import { describe, expect, it } from "vitest";
import { defaultLaterStart, showWindow } from "./record-times";

const now = Date.parse("2026-11-13T12:00:00Z");
const min = 60_000;

describe("record times", () => {
  it("records an upcoming show from 1 min early to 2 min late", () => {
    expect(showWindow({ title: "News", start: now + 60 * min, end: now + 90 * min }, now)).toEqual({ start: now + 59 * min, end: now + 92 * min });
  });
  it("records a show already on from now until 2 min after it ends", () => {
    expect(showWindow({ title: "News", start: now - 10 * min, end: now + 20 * min }, now)).toEqual({ start: now, end: now + 22 * min });
  });
  it("Later starts on the next listed show", () => {
    expect(defaultLaterStart([{ title: "A", start: now - 5 * min, end: now + 25 * min }, { title: "B", start: now + 25 * min, end: now + 55 * min }], now)).toBe(now + 25 * min);
  });
  it("Later falls back to an hour from now without a guide", () => {
    expect(defaultLaterStart([], now)).toBe(now + 60 * min);
  });
});
