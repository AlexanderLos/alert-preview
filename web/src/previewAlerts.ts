import type { PriceReading } from "./api.ts";

export function previewAlerts(
  readings: PriceReading[],
  threshold: number,
  minMinutesBetween: number,
): PriceReading[] {
  const alerts: PriceReading[] = [];
  let cooldownEndsAt = 0;

  for (const reading of readings) {
    // Use UTC: local times repeat for an hour when daylight saving ends
    const time = Date.parse(reading.interval_start_utc);

    if (reading.spp >= threshold && time >= cooldownEndsAt) {
      alerts.push(reading);
      cooldownEndsAt = time + minMinutesBetween * 60 * 1000;
    }
  }

  return alerts;
}
