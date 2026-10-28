import { test, expect, vi, beforeEach, afterEach } from "vitest";

// app.ts reads its env vars on import, so each set needs a fresh import. It
// throws without an API key, and a blank KV_REST_API_URL keeps Redis off even
// if the Upstash vars are set in your shell.
async function importApp(env: Record<string, string> = {}) {
  vi.resetModules();
  const vars = { GRIDSTATUS_API_KEY: "test-key", KV_REST_API_URL: "", ...env };
  for (const [name, value] of Object.entries(vars)) {
    vi.stubEnv(name, value);
  }
  const { default: app } = await import("./app.js");
  return app;
}

const app = await importApp();

// One page of Grid Status results with no next page
function page(data: object[] = []): Response {
  return Response.json({ data, meta: { hasNextPage: false } });
}

function getPrices(query: string) {
  return app.request(`/api/prices?${query}`);
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => page());
  // The handler logs one line per request
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test.each([
  [
    "a missing param",
    "location=HB_HOUSTON&start=2025-01-01",
    "location, start, and end are required",
  ],
  [
    "an unknown hub",
    "location=HB_PAN&start=2025-01-01&end=2025-01-01",
    "location must be one of HB_HOUSTON, HB_NORTH, HB_SOUTH, HB_WEST",
  ],
  [
    "a date without leading zeros",
    "location=HB_HOUSTON&start=2026-1-5&end=2026-01-06",
    "start and end must be dates in YYYY-MM-DD format",
  ],
  [
    "a day that doesn't exist",
    "location=HB_HOUSTON&start=2026-02-01&end=2026-02-30",
    "start and end must be dates in YYYY-MM-DD format",
  ],
  [
    "a month that doesn't exist",
    "location=HB_HOUSTON&start=2026-01-01&end=2026-13-01",
    "start and end must be dates in YYYY-MM-DD format",
  ],
  [
    "end before start",
    "location=HB_HOUSTON&start=2025-01-02&end=2025-01-01",
    "end must be on or after start",
  ],
  [
    "end after today",
    "location=HB_HOUSTON&start=2999-01-01&end=2999-01-01",
    "end can't be after today",
  ],
  [
    "32 days",
    "location=HB_HOUSTON&start=2025-01-01&end=2025-02-01",
    "range can be at most 31 days",
  ],
])("rejects %s", async (_problem, query, error) => {
  const response = await getPrices(query);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error });
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining(` 400 ${error}`),
  );
});

test("allows today in CT but not tomorrow", async () => {
  // 11:30 PM CDT on Oct 27, already Oct 28 in UTC and Eastern time
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T04:30:00Z"));

  const today = await getPrices(
    "location=HB_HOUSTON&start=2026-10-27&end=2026-10-27",
  );
  const tomorrow = await getPrices(
    "location=HB_HOUSTON&start=2026-10-28&end=2026-10-28",
  );

  expect(today.status).toBe(200);
  expect(tomorrow.status).toBe(400);
});

test("allows exactly 31 days", async () => {
  const response = await getPrices(
    "location=HB_HOUSTON&start=2025-01-01&end=2025-01-31",
  );

  expect(response.status).toBe(200);
});

test("returns the readings as a JSON array", async () => {
  const reading = { interval_start_utc: "2025-03-01T06:00:00+00:00", spp: 42 };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(page([reading]));

  const response = await getPrices(
    "location=HB_HOUSTON&start=2025-03-01&end=2025-03-01",
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([reading]);
});

test("logs a cache miss, then a cache hit", async () => {
  const query = "location=HB_HOUSTON&start=2025-06-01&end=2025-06-01";

  await getPrices(query);
  await getPrices(query);

  expect(vi.mocked(console.log).mock.calls).toEqual([
    [
      expect.stringMatching(
        /^prices HB_HOUSTON 2025-06-01\.\.2025-06-01 cache=miss pages=1 \d+ms$/,
      ),
    ],
    [
      expect.stringMatching(
        /^prices HB_HOUSTON 2025-06-01\.\.2025-06-01 cache=hit pages=0 \d+ms$/,
      ),
    ],
  ]);
});

test("keeps a newline in the query out of the log", async () => {
  await getPrices("location=HB_X%0Aprices&start=2025-01-01&end=2025-01-01");

  expect(console.warn).toHaveBeenCalledWith(
    "prices HB_X prices 2025-01-01..2025-01-01 400 location must be one of HB_HOUSTON, HB_NORTH, HB_SOUTH, HB_WEST",
  );
});

test("turns a Grid Status 429 into a 503 without the key", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      { detail: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429 },
    ),
  );

  const response = await getPrices(
    "location=HB_HOUSTON&start=2025-04-01&end=2025-04-01",
  );
  const body = await response.text();

  expect(response.status).toBe(503);
  expect(JSON.parse(body)).toEqual({
    error: "Grid Status limit reached. Try again later.",
  });
  expect(body).not.toContain("test-key");
  expect(console.error).toHaveBeenCalledWith(
    expect.stringMatching(
      /^prices HB_HOUSTON 2025-04-01\.\.2025-04-01 failed 503 \(Grid Status 429: Rate limit exceeded\. Try again in 60 seconds\.\) \d+ms$/,
    ),
  );
});

test("trims the API key, so the log hides the key fetch quotes", async () => {
  const paddedApp = await importApp({ GRIDSTATUS_API_KEY: "test\nkey\n" });
  // Real fetch strips the newline at the end, then rejects the one inside
  // and quotes the key, before sending anything
  vi.mocked(fetch).mockRestore();

  const response = await paddedApp.request(
    "/api/prices?location=HB_HOUSTON&start=2025-07-01&end=2025-07-01",
  );

  expect(response.status).toBe(502);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringMatching(
      /^prices HB_HOUSTON 2025-07-01\.\.2025-07-01 failed 502 \(TypeError: Headers\.append: "<key>" is an invalid header value\.\) \d+ms$/,
    ),
  );
});

test("hides an unexpected failure behind a 500", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json"));

  const response = await getPrices(
    "location=HB_HOUSTON&start=2025-05-01&end=2025-05-01",
  );

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Something went wrong." });
});
