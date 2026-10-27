import { test, expect, vi, afterEach } from "vitest";
import { memoryCache } from "./cache.js";
import { gridAPI, GridStatusError } from "./gridapi.js";

const query = {
  location: "HB_HOUSTON",
  start: "2026-10-01",
  end: "2026-10-07",
};

// One page of Grid Status results; a cursor means another page follows
function page(data: object[] = [], cursor?: string): Response {
  return Response.json({
    data,
    meta: { hasNextPage: cursor !== undefined, cursor },
  });
}

// Grid Status sends errors as { "detail": "..." }
function failure(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

// A query parameter Grid Status received on the given fetch call
function sentParam(call: number, name: string): string | null {
  const [url] = vi.mocked(fetch).mock.calls[call];
  return new URL(String(url)).searchParams.get(name);
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("follows the cursor across pages and keeps the readings in order", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(page([{ spp: 1 }], "cursor-1"))
    .mockResolvedValueOnce(page([{ spp: 2 }], "cursor-2"))
    .mockResolvedValueOnce(page([{ spp: 3 }]));
  const grid = new gridAPI("test-key", memoryCache());

  const result = await grid.fetchAllPrices(query);

  expect(result).toEqual({
    readings: [{ spp: 1 }, { spp: 2 }, { spp: 3 }],
    pages: 3,
  });
  expect(sentParam(0, "cursor")).toBeNull();
  expect(sentParam(1, "cursor")).toBe("cursor-1");
  expect(sentParam(2, "cursor")).toBe("cursor-2");
});

test("the same query twice only calls fetch once", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => page());
  const grid = new gridAPI("test-key", memoryCache());

  await grid.fetchAllPrices(query);
  const second = await grid.fetchAllPrices(query);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(second.pages).toBe(0);
});

test.each([
  ["hub", { location: "HB_NORTH" }],
  ["start", { start: "2026-10-02" }],
  ["end", { end: "2026-10-06" }],
])("a different %s calls fetch again", async (_field, change) => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => page());
  const grid = new gridAPI("test-key", memoryCache());

  await grid.fetchAllPrices(query);
  await grid.fetchAllPrices({ ...query, ...change });

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a failed page isn't cached", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(page([{ spp: 1 }], "cursor-1"))
    .mockResolvedValueOnce(failure(500, "Internal server error"))
    .mockResolvedValueOnce(page([{ spp: 1 }], "cursor-1"))
    .mockResolvedValueOnce(page([{ spp: 2 }]));
  const grid = new gridAPI("test-key", memoryCache());

  await expect(grid.fetchAllPrices(query)).rejects.toThrow(GridStatusError);
  await expect(grid.fetchAllPrices(query)).resolves.toEqual({
    readings: [{ spp: 1 }, { spp: 2 }],
    pages: 2,
  });
});

test("asks Grid Status for the hub through the day after the end date", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => page());
  const grid = new gridAPI("test-key", memoryCache());

  await grid.fetchAllPrices(query);

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({
    filter_column: "location",
    filter_value: "HB_HOUSTON",
    start_time: "2026-10-01",
    end_time: "2026-10-08",
    timezone: "market",
  });
  expect(init?.headers).toEqual({ "x-api-key": "test-key" });
  expect(init?.signal).toBeInstanceOf(AbortSignal);
});

test("logs the network error behind a failed fetch", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("fetch failed", {
      cause: new Error("connect ECONNREFUSED 127.0.0.1:443"),
    }),
  );
  const grid = new gridAPI("test-key", memoryCache());

  const error: GridStatusError = await grid
    .fetchAllPrices(query)
    .catch((err) => err);

  expect(error.reason).toBe("Error: connect ECONNREFUSED 127.0.0.1:443");
});

test.each([
  [
    "400",
    502,
    "Grid Status rejected the server's API key or plan.",
    async () => failure(400, "Invalid API key."),
  ],
  [
    "401",
    502,
    "Grid Status rejected the server's API key or plan.",
    async () => failure(401, "Missing API Key."),
  ],
  [
    "403",
    502,
    "Grid Status rejected the server's API key or plan.",
    async () => failure(403, "Your plan doesn't include this dataset"),
  ],
  [
    "429",
    503,
    "Grid Status limit reached. Try again later.",
    async () => failure(429, "Rate limit exceeded. Try again in 60 seconds."),
  ],
  [
    "500",
    502,
    "Grid Status is unavailable right now.",
    async () => new Response("<html>Server Error</html>", { status: 500 }),
  ],
  [
    "422",
    502,
    "Grid Status rejected the request.",
    async () => failure(422, "Invalid filter_column"),
  ],
  [
    "a timeout",
    504,
    "Grid Status took too long to respond.",
    () =>
      Promise.reject(
        new DOMException("The operation timed out", "TimeoutError"),
      ),
  ],
  [
    "a network failure",
    502,
    "Couldn't reach Grid Status.",
    () => Promise.reject(new TypeError("fetch failed")),
  ],
  [
    "a key fetch can't send",
    502,
    "Couldn't reach Grid Status.",
    () =>
      Promise.reject(
        new TypeError('Headers.append: "test-key" is an invalid header value.'),
      ),
  ],
])("maps %s to %i", async (_upstream, status, message, reply) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(reply);
  const grid = new gridAPI("test-key", memoryCache());

  const error: GridStatusError = await grid
    .fetchAllPrices(query)
    .catch((err) => err);

  expect(error).toBeInstanceOf(GridStatusError);
  expect(error.status).toBe(status);
  expect(error.message).toBe(message);
  expect(error.message).not.toContain("test-key");
  expect(error.reason).not.toContain("test-key");
});
