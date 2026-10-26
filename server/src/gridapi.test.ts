import { test, mock, afterEach } from "node:test"
import assert from "node:assert/strict"
import { gridAPI } from "./gridapi.js"

// One page of results with no next page, so fetchAllPrices makes a single request
function onePage(): Response {
    return new Response(JSON.stringify({ data: [], meta: { hasNextPage: false } }))
}

afterEach(() => {
    mock.restoreAll()
})

test("the same query twice only calls fetch once", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => onePage())
    const grid = new gridAPI("test-key")
    const query = { location: "HB_HOUSTON", start: "2026-10-01", end: "2026-10-02" }

    await grid.fetchAllPrices(query)
    await grid.fetchAllPrices(query)

    assert.equal(fetchMock.mock.callCount(), 1)
})

test("a different date range calls fetch again", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => onePage())
    const grid = new gridAPI("test-key")

    await grid.fetchAllPrices({ location: "HB_HOUSTON", start: "2026-10-01", end: "2026-10-02" })
    await grid.fetchAllPrices({ location: "HB_HOUSTON", start: "2026-10-02", end: "2026-10-03" })

    assert.equal(fetchMock.mock.callCount(), 2)
})
