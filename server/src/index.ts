import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { gridAPI } from './gridapi.js'
import { previewAlerts } from './previewAlerts.js'

//Importing API key
process.loadEnvFile();
const apiKey = process.env.GRIDSTATUS_API_KEY
if (!apiKey) {
  throw new Error('GRIDSTATUS_API_KEY is not set')
}

const app = new Hono()
const grid = new gridAPI(apiKey)

// Fetch
app.get("/api/prices", async (c) => {
  const { location, start, end } = c.req.query()
  if (!location || !start || !end) {
    return c.json({ error: 'location, start, and end are required' }, 400)
  }

  const prices = await grid.fetchAllPrices({ location, start, end })
  return c.json(prices)
});

// Preview
app.get("/api/preview", async (c) => {
  const { location, start, end, threshold, minMinutesBetween } = c.req.query()
  if (!location || !start || !end || !threshold || !minMinutesBetween) {
    return c.json({ error: 'location, start, end, threshold, and minMinutesBetween are required' }, 400)
  }

  const thresholdNumber = Number(threshold)
  const minMinutesNumber = Number(minMinutesBetween)
  if (Number.isNaN(thresholdNumber) || Number.isNaN(minMinutesNumber) || minMinutesNumber < 0) {
    return c.json({ error: 'threshold and minMinutesBetween must be numbers, and minMinutesBetween cannot be negative' }, 400)
  }

  const readings = await grid.fetchAllPrices({ location, start, end })
  const alerts = previewAlerts(readings, thresholdNumber, minMinutesNumber)
  return c.json({ count: alerts.length, alerts })
});

// Link to frontend
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
