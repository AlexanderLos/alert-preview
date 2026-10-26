import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { gridAPI } from './gridapi.js'

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

// Link to frontend
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
