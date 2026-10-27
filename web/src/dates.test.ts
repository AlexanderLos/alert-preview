import { expect, test } from "vitest";
import { presets, rangeError } from "./dates.ts";

test("allows a single day", () => {
  expect(rangeError("2026-10-05", "2026-10-05")).toBeUndefined();
});

test("allows exactly 31 days but not 32", () => {
  expect(rangeError("2026-10-01", "2026-10-31")).toBeUndefined();
  expect(rangeError("2026-10-01", "2026-11-01")).toBe("Pick 31 days or fewer.");
});

test("rejects an end date before the start date", () => {
  expect(rangeError("2026-10-07", "2026-10-01")).toBe(
    "End date is before start date.",
  );
});

test("last 7 and 30 days end yesterday", () => {
  const [week, month] = presets("2026-10-27");

  expect(week).toEqual({
    label: "Last 7 days",
    start: "2026-10-20",
    end: "2026-10-26",
  });
  expect(month).toEqual({
    label: "Last 30 days",
    start: "2026-09-27",
    end: "2026-10-26",
  });
});

test("same month last year covers the whole month, leap day included", () => {
  expect(presets("2025-02-10")[2]).toEqual({
    label: "Same month last year",
    start: "2024-02-01",
    end: "2024-02-29",
  });
});
