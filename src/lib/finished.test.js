import { test, expect } from "bun:test";
import { isFinished } from "./finished.ts";

test("stopping in the credits of a 54:48 episode counts as finished", () => {
  expect(isFinished(47 * 60 + 23, 54 * 60 + 48)).toBe(true);
});

test("stopping at 15:00 of a 54:48 episode is still in progress", () => {
  expect(isFinished(15 * 60, 54 * 60 + 48)).toBe(false);
});

test("a 22-minute episode stopped at 20:30 counts as finished", () => {
  expect(isFinished(20 * 60 + 30, 22 * 60)).toBe(true);
});

test("unknown length never counts as finished", () => {
  expect(isFinished(5000, null)).toBe(false);
});
