import { afterEach, expect, test, vi } from "vitest";
import { fetchPrices, TooManyRequestsError } from "./api.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function load() {
  return fetchPrices("HB_HOUSTON", "2026-10-01", "2026-10-07");
}

test("rejects a 429 as TooManyRequestsError", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 429 }),
  );

  await expect(load()).rejects.toBeInstanceOf(TooManyRequestsError);
});

test.each([
  ["a 503", async () => new Response(null, { status: 503 })],
  ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
])("doesn't treat %s as a rate limit", async (_failure, reply) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(reply);

  const error = await load().catch((err) => err);

  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(TooManyRequestsError);
});
