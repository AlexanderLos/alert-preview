import { test, expect, vi, afterEach } from "vitest";
import { yesterdayCT } from "./dates.js";

afterEach(() => {
  vi.useRealTimers();
});

// Spring-forward and fall-back days are 23 and 25 hours, so now minus 24 hours
// is a day off for the first two. Late evening CT is already tomorrow in UTC.
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
