import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { LIMIT, rateLimit } from "./ratelimit.js";
import { createUpstash } from "./redis.js";

// 23 seconds before the next minute starts
const now = new Date("2026-10-28T15:00:37Z");
const key = `ratelimit:203.0.113.7:${Math.floor(now.getTime() / 60_000)}`;

function useUpstash() {
  vi.stubEnv("KV_REST_API_URL", "https://redis.test");
  vi.stubEnv("KV_REST_API_TOKEN", "redis-token");
  return createUpstash();
}

// Upstash's answer to INCR and EXPIRE: the IP's request count this minute
function counted(count: number): Response {
  return Response.json([{ result: count }, { result: 1 }]);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test(`lets an IP make ${LIMIT} requests a minute`, async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(counted(LIMIT));

  expect(await rateLimit(useUpstash(), "203.0.113.7")).toBeUndefined();

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("https://redis.test/pipeline");
  expect(JSON.parse(String(init?.body))).toEqual([
    ["incr", key],
    ["expire", key, 60],
  ]);
});

test("makes an IP over the limit wait until the next minute", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(counted(LIMIT + 1));

  expect(await rateLimit(useUpstash(), "203.0.113.7")).toBe(23);
});

test("lets the request through when Redis fails, and logs why", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("fetch failed", {
      cause: new Error("getaddrinfo ENOTFOUND redis.test"),
    }),
  );

  expect(await rateLimit(useUpstash(), "203.0.113.7")).toBeUndefined();
  expect(console.error).toHaveBeenCalledWith(
    "rate limit check failed for 203.0.113.7 (Error: getaddrinfo ENOTFOUND redis.test)",
  );
});

test("lets a request without an IP through", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");

  expect(await rateLimit(useUpstash(), undefined)).toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("lets every request through when Redis isn't configured", async () => {
  vi.stubEnv("KV_REST_API_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const fetchMock = vi.spyOn(globalThis, "fetch");

  expect(await rateLimit(createUpstash(), "203.0.113.7")).toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});
