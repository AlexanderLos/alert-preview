import type { PriceReading } from "./gridapi.js"

export function previewAlerts(readings: PriceReading[], threshold: number, minMinutesBetween: number): PriceReading[] {
    const alerts: PriceReading[] = []
    let cooldownEndsAt = 0

    for (const reading of readings) {
        // Use UTC: local times repeat for an hour when daylight saving ends
        const time = Date.parse(reading.interval_start_utc)

        if (reading.spp >= threshold && time >= cooldownEndsAt) {
            alerts.push(reading)
            // Start a cooldown: no new alert until minMinutesBetween minutes after this one
            cooldownEndsAt = time + minMinutesBetween * 60 * 1000
        }
    }

    return alerts
}
