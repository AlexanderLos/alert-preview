import { expect, test } from "vitest";
import { formatTime, formatUsd, formatUsdShort } from "./format.ts";

test("shows times in Central Time on both sides of daylight saving", () => {
  // CDT is UTC-5
  expect(formatTime("2026-10-05T00:45:00+00:00")).toBe("Oct 4, 7:45 PM");
  // CST is UTC-6
  expect(formatTime("2026-12-05T01:45:00+00:00")).toBe("Dec 4, 7:45 PM");
});

test("shows dollars with a thousands separator and cents", () => {
  expect(formatUsd(1118.42)).toBe("$1,118.42");
});

test("short dollars drop zero cents", () => {
  expect(formatUsdShort(100)).toBe("$100");
  expect(formatUsdShort(100.5)).toBe("$100.5");
});
