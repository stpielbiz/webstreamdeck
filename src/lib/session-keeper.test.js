import { describe, expect, test, mock } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
mock.module("@/lib/debug-log", () => ({ trace: () => {} }));
const { isAuthRejection } = await import("./session-keeper");

describe("sign-in check", () => {
  test("a connection failure does not sign the device out", () => {
    expect(isAuthRejection({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" })).toBe(false);
    expect(isAuthRejection({ status: 504 })).toBe(false);
  });
  test("a server rejection signs the device out", () => {
    expect(isAuthRejection({ status: 401 })).toBe(true);
    expect(isAuthRejection({ code: "session_not_found", status: 400 })).toBe(true);
  });
});
