import { afterEach, expect, test, vi } from "vitest";
import { fetchPrices, loadErrorMessage } from "./api.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
  [
    "a 429",
    "Too many requests. Try again in a minute.",
    async () => new Response(null, { status: 429 }),
  ],
  [
    "a 503",
    "Couldn't load prices from Grid Status.",
    async () => new Response(null, { status: 503 }),
  ],
  [
    "a network failure",
    "Couldn't load prices from Grid Status.",
    () => Promise.reject(new TypeError("Failed to fetch")),
  ],
])("explains %s", async (_failure, message, reply) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(reply);

  const error = await fetchPrices(
    "HB_HOUSTON",
    "2026-10-01",
    "2026-10-07",
  ).catch((err) => err);

  expect(error).toBeInstanceOf(Error);
  expect(loadErrorMessage(error)).toBe(message);
});
