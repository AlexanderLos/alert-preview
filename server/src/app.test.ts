import { test, expect, vi, beforeEach, afterEach } from "vitest";

// app.ts throws on import without an API key
vi.stubEnv("GRIDSTATUS_API_KEY", "test-key");
const { default: app } = await import("./app.js");

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
});

test("hides an unexpected failure behind a 500", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json"));

  const response = await getPrices(
    "location=HB_HOUSTON&start=2025-05-01&end=2025-05-01",
  );

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Something went wrong." });
});
