import { test } from "node:test"
import assert from "node:assert/strict"
import { previewAlerts } from "./previewAlerts.js"
import type { PriceReading } from "./gridapi.js"

// Only the UTC start time and the price matter to previewAlerts
function reading(utc: string, spp: number): PriceReading {
    return {
        interval_start_local: "",
        interval_start_utc: utc,
        interval_end_local: "",
        interval_end_utc: "",
        location: "",
        location_type: "",
        market: "",
        spp
    }
}

test("returns no alerts when every price is below the threshold", () => {
    const readings = [
        reading("2026-10-01T05:00:00+00:00", 40),
        reading("2026-10-01T05:15:00+00:00", 99.99)
    ]

    assert.deepEqual(previewAlerts(readings, 100, 0), [])
})

test("alerts when the price exactly equals the threshold", () => {
    const readings = [reading("2026-10-01T05:00:00+00:00", 100)]

    assert.deepEqual(previewAlerts(readings, 100, 0), readings)
})

test("alerts on every qualifying reading when the cooldown is 0", () => {
    const readings = [
        reading("2026-10-01T05:00:00+00:00", 150),
        reading("2026-10-01T05:15:00+00:00", 150),
        reading("2026-10-01T05:30:00+00:00", 150)
    ]

    assert.deepEqual(previewAlerts(readings, 100, 0), readings)
})

test("suppresses alerts inside the cooldown window", () => {
    const readings = [
        reading("2026-10-01T05:00:00+00:00", 150),
        reading("2026-10-01T05:15:00+00:00", 150),
        reading("2026-10-01T05:30:00+00:00", 150),
        reading("2026-10-01T05:45:00+00:00", 150)
    ]

    assert.deepEqual(previewAlerts(readings, 100, 60), [readings[0]])
})

test("alerts again exactly when the cooldown ends", () => {
    const readings = [
        reading("2026-10-01T05:00:00+00:00", 150),
        reading("2026-10-01T05:45:00+00:00", 150),
        reading("2026-10-01T06:00:00+00:00", 150)
    ]

    assert.deepEqual(previewAlerts(readings, 100, 60), [readings[0], readings[2]])
})
