import { describe, expect, it } from "vitest";
import { parseXtreamFromM3u } from "./m3u-xtream";

describe("parseXtreamFromM3u", () => {
  it("reads get.php links with a port", () => {
    expect(parseXtreamFromM3u("http://srv.tv:8080/get.php?username=ab&password=cd&type=m3u_plus&output=ts"))
      .toEqual({ serverUrl: "http://srv.tv:8080", username: "ab", password: "cd" });
  });
  it("keeps https", () => {
    expect(parseXtreamFromM3u("https://x.io/get.php?username=u&password=p")?.serverUrl).toBe("https://x.io");
  });
  it("needs a password", () => {
    expect(parseXtreamFromM3u("http://x.io/get.php?username=u")).toBeNull();
  });
  it("reads /playlist/user/pass links", () => {
    expect(parseXtreamFromM3u("http://x.io/playlist/u1/p1/m3u_plus"))
      .toEqual({ serverUrl: "http://x.io", username: "u1", password: "p1" });
  });
  it("ignores plain m3u files", () => {
    expect(parseXtreamFromM3u("http://x.io/list.m3u")).toBeNull();
  });
});
