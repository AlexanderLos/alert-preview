import { test, expect } from "vitest";
import { previewAlerts } from "./previewAlerts.ts";

function reading(utc: string, spp: number) {
  return { interval_start_utc: utc, interval_start_local: "", spp };
}

test("returns no alerts when every price is below the threshold", () => {
  const readings = [
    reading("2026-10-01T05:00:00+00:00", 40),
    reading("2026-10-01T05:15:00+00:00", 99.99),
  ];

  expect(previewAlerts(readings, 100, 0)).toEqual([]);
});

test("alerts when the price exactly equals the threshold", () => {
  const readings = [reading("2026-10-01T05:00:00+00:00", 100)];

  expect(previewAlerts(readings, 100, 0)).toEqual(readings);
});

test("alerts on every qualifying reading when the cooldown is 0", () => {
  const readings = [
    reading("2026-10-01T05:00:00+00:00", 150),
    reading("2026-10-01T05:15:00+00:00", 150),
    reading("2026-10-01T05:30:00+00:00", 150),
  ];

  expect(previewAlerts(readings, 100, 0)).toEqual(readings);
});

test("suppresses alerts inside the cooldown window", () => {
  const readings = [
    reading("2026-10-01T05:00:00+00:00", 150),
    reading("2026-10-01T05:15:00+00:00", 150),
    reading("2026-10-01T05:30:00+00:00", 150),
    reading("2026-10-01T05:45:00+00:00", 150),
  ];

  expect(previewAlerts(readings, 100, 60)).toEqual([readings[0]]);
});

test("alerts again exactly when the cooldown ends", () => {
  const readings = [
    reading("2026-10-01T05:00:00+00:00", 150),
    reading("2026-10-01T05:45:00+00:00", 150),
    reading("2026-10-01T06:00:00+00:00", 150),
  ];

  expect(previewAlerts(readings, 100, 60)).toEqual([readings[0], readings[2]]);
});

test("alerts once an hour across the fall-back DST day", () => {
  // CT midnight on Nov 2, 2025, a 25-hour day. 1:00–1:45 AM happens twice in
  // local time, so the cooldown must run on real time.
  const midnight = Date.parse("2025-11-02T05:00:00Z");
  const readings = Array.from({ length: 100 }, (_, i) =>
    reading(new Date(midnight + i * 15 * 60 * 1000).toISOString(), 150),
  );

  expect(previewAlerts(readings, 100, 60)).toHaveLength(25);
});

test("returns no alerts when there are no readings", () => {
  expect(previewAlerts([], 100, 0)).toEqual([]);
});
