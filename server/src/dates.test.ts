import { test, expect, vi, afterEach } from "vitest";
import { yesterdayCT } from "./dates.js";

afterEach(() => {
  vi.useRealTimers();
});

// Spring-forward day is 23 hours long and fall-back day 25, so 24 hours before
// the first two moments is the wrong date. Late evening in CT is already the
// next day in UTC.
test.each([
  ["12:30 AM CDT after spring forward", "2026-03-09T05:30:00Z", "2026-03-08"],
  ["11:30 PM CST on fall-back day", "2026-11-02T05:30:00Z", "2026-10-31"],
  ["12:30 AM CST on New Year's Day", "2027-01-01T06:30:00Z", "2026-12-31"],
  ["11:30 PM CST on New Year's Eve", "2027-01-01T05:30:00Z", "2026-12-30"],
])("yesterdayCT at %s", (_moment, now, yesterday) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));

  expect(yesterdayCT()).toBe(yesterday);
});
