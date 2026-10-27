import { Hono } from "hono";
import { gridAPI } from "./gridapi.js";

// API key comes from server/.env locally and from project env vars on Vercel
const apiKey = process.env.GRIDSTATUS_API_KEY;
if (!apiKey) {
  throw new Error("GRIDSTATUS_API_KEY is not set");
}

const app = new Hono();
const grid = new gridAPI(apiKey);

// Fetch
app.get("/api/prices", async (c) => {
  const { location, start, end } = c.req.query();
  if (!location || !start || !end) {
    return c.json({ error: "location, start, and end are required" }, 400);
  }

  const prices = await grid.fetchAllPrices({ location, start, end });
  return c.json(prices);
});

export default app;
