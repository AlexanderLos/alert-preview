import { test, expect, vi, afterEach } from "vitest";
import { createCache } from "./cache.js";
import type { PriceReading } from "./gridapi.js";

const reading: PriceReading = {
  interval_start_local: "2026-10-01T00:00:00-05:00",
  interval_start_utc: "2026-10-01T05:00:00+00:00",
  interval_end_local: "2026-10-01T00:15:00-05:00",
  interval_end_utc: "2026-10-01T05:15:00+00:00",
  location: "HB_HOUSTON",
  location_type: "Trading Hub",
  market: "REAL_TIME_15_MIN",
  spp: 42.5,
};

function useUpstash() {
  vi.stubEnv("KV_REST_API_URL", "https://redis.test");
  vi.stubEnv("KV_REST_API_TOKEN", "redis-token");
}

// Upstash batches commands into a pipeline, so each fetch sends a list of them
function sentCommands(call: number): unknown[][] {
  const [, init] = vi.mocked(fetch).mock.calls[call];
  return JSON.parse(String(init?.body));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("reads a range from Upstash when both env vars are set", async () => {
  useUpstash();
  // Upstash sends values base64 encoded
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json([{ result: btoa(JSON.stringify([reading])) }]),
  );

  const readings = await createCache().get("range-key");

  expect(readings).toEqual([reading]);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("https://redis.test/pipeline");
  expect(init?.headers).toMatchObject({ authorization: "Bearer redis-token" });
  expect(sentCommands(0)).toEqual([["get", "range-key"]]);
});

test("trims whitespace pasted into the env vars", async () => {
  vi.stubEnv("KV_REST_API_URL", "https://redis.test\n");
  vi.stubEnv("KV_REST_API_TOKEN", " redis-token\n");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json([{ result: null }]),
  );

  await createCache().get("range-key");

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("https://redis.test/pipeline");
  expect(init?.headers).toMatchObject({ authorization: "Bearer redis-token" });
});

test("stores a range with an expiry only when given one", async () => {
  useUpstash();
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json([{ result: "OK" }]),
  );
  const cache = createCache();

  await cache.set("today-key", [reading], 300);
  await cache.set("past-key", [reading]);

  const value = JSON.stringify([reading]);
  expect(sentCommands(0)).toEqual([["set", "today-key", value, "ex", 300]]);
  expect(sentCommands(1)).toEqual([["set", "past-key", value]]);
});

test("treats a failed read as a miss after one attempt", async () => {
  useUpstash();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("fetch failed", {
      cause: new Error("getaddrinfo ENOTFOUND redis.test"),
    }),
  );

  const readings = await createCache().get("range-key");

  expect(readings).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "cache read failed for range-key (Error: getaddrinfo ENOTFOUND redis.test)",
  );
});

test("keeps the token out of the log and cuts long errors short", async () => {
  useUpstash();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(
      new TypeError(
        'Headers.append: "Bearer redis-token" is an invalid header value.',
      ),
    )
    .mockResolvedValueOnce(
      Response.json({ error: "OOM command not allowed" }, { status: 400 }),
    );
  const cache = createCache();

  await cache.get("range-key");
  await cache.set("range-key", Array(1_000).fill(reading));

  const [[readLog], [writeLog]] = vi.mocked(console.error).mock.calls;
  expect(readLog).toBe(
    'cache read failed for range-key (TypeError: Headers.append: "Bearer <token>" is an invalid header value.)',
  );
  // Upstash's message goes on to list the whole command, every reading
  expect(writeLog).toMatch(
    /^cache write failed for range-key \(UpstashError: OOM command not allowed, command was: /,
  );
  expect(writeLog.length).toBeLessThan(300);
});

test("gives up on a hung Redis after 2s, timing each request on its own", async () => {
  useUpstash();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    // Like fetch, settles only when its signal aborts
    .mockImplementationOnce(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    )
    .mockResolvedValueOnce(Response.json([{ result: "OK" }]));
  const cache = createCache();

  expect(await cache.get("range-key")).toBeNull();
  await cache.set("range-key", [reading]);

  expect(console.error).toHaveBeenCalledWith(
    "cache read failed for range-key (TimeoutError: The operation was aborted due to timeout)",
  );
  // A signal shared across requests would already be aborted by now
  expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(false);
});

test("keeps ranges in memory when the URL isn't an Upstash REST URL", async () => {
  useUpstash();
  vi.stubEnv(
    "KV_REST_API_URL",
    "rediss://default:redis-password@redis.test:6379",
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const cache = createCache();

  await cache.set("range-key", [reading]);

  expect(await cache.get("range-key")).toEqual([reading]);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith(
    "KV_REST_API_URL isn't an Upstash REST URL, so prices are cached in memory",
  );
});

test.each(["KV_REST_API_URL", "KV_REST_API_TOKEN"])(
  "keeps ranges in memory when %s is missing",
  async (missing) => {
    useUpstash();
    vi.stubEnv(missing, "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const cache = createCache();

    await cache.set("range-key", [reading]);

    expect(await cache.get("range-key")).toEqual([reading]);
    expect(await cache.get("other-key")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
