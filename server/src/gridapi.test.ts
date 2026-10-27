import { test, expect, vi, afterEach } from "vitest";
import { gridAPI } from "./gridapi.js";

// One page of results with no next page, so fetchAllPrices makes a single request
function onePage(): Response {
  return new Response(
    JSON.stringify({ data: [], meta: { hasNextPage: false } }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("the same query twice only calls fetch once", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => onePage());
  const grid = new gridAPI("test-key");
  const query = {
    location: "HB_HOUSTON",
    start: "2026-10-01",
    end: "2026-10-02",
  };

  await grid.fetchAllPrices(query);
  await grid.fetchAllPrices(query);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a different date range calls fetch again", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => onePage());
  const grid = new gridAPI("test-key");

  await grid.fetchAllPrices({
    location: "HB_HOUSTON",
    start: "2026-10-01",
    end: "2026-10-02",
  });
  await grid.fetchAllPrices({
    location: "HB_HOUSTON",
    start: "2026-10-02",
    end: "2026-10-03",
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("asks Grid Status for the day after the end date", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => onePage());
  const grid = new gridAPI("test-key");

  await grid.fetchAllPrices({
    location: "HB_HOUSTON",
    start: "2026-10-01",
    end: "2026-10-07",
  });

  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.searchParams.get("end_time")).toBe("2026-10-08");
});
