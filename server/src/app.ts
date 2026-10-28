import { Hono } from "hono";
import { createCache } from "./cache.js";
import { gridAPI, GridStatusError } from "./gridapi.js";
import { todayCT } from "./dates.js";

const LOCATIONS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST"];
const MAX_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

// API key comes from server/.env locally and from project env vars on Vercel.
// fetch strips pasted whitespace from the key it sends, so trim it the same
// way, or a key fetch quotes in an error won't match the one the logs redact.
const apiKey = process.env.GRIDSTATUS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("GRIDSTATUS_API_KEY is not set");
}

const app = new Hono();
const grid = new gridAPI(apiKey, createCache());

// Fetch
app.get("/api/prices", async (c) => {
  const startedAt = Date.now();
  const { location, start, end } = c.req.query();
  const label = `prices ${logValue(location)} ${logValue(start)}..${logValue(end)}`;

  const error = validate(location, start, end);
  if (error) {
    console.warn(`${label} 400 ${error}`);
    return c.json({ error }, 400);
  }

  try {
    const { readings, pages } = await grid.fetchAllPrices({
      location,
      start,
      end,
    });
    const cache = pages === 0 ? "hit" : "miss";
    console.log(
      `${label} cache=${cache} pages=${pages} ${Date.now() - startedAt}ms`,
    );
    return c.json(readings);
  } catch (err) {
    if (err instanceof GridStatusError) {
      console.error(
        `${label} failed ${err.status} (${err.reason}) ${Date.now() - startedAt}ms`,
      );
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  }
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

// Query values go into the log raw, so a newline could fake a second line
function logValue(value?: string): string {
  return value?.replace(/[\r\n]/g, " ") || "-";
}

// Returns what's wrong with the query, or undefined if it's valid
function validate(
  location?: string,
  start?: string,
  end?: string,
): string | undefined {
  if (!location || !start || !end) {
    return "location, start, and end are required";
  }
  if (!LOCATIONS.includes(location)) {
    return `location must be one of ${LOCATIONS.join(", ")}`;
  }
  if (!isDate(start) || !isDate(end)) {
    return "start and end must be dates in YYYY-MM-DD format";
  }
  if (end < start) {
    return "end must be on or after start";
  }
  if (end > todayCT()) {
    return "end can't be after today";
  }
  // YYYY-MM-DD parses as UTC midnight, so daylight saving can't skew the count
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;
  if (days > MAX_DAYS) {
    return `range can be at most ${MAX_DAYS} days`;
  }
}

// Date.parse rolls "2026-02-30" over to March 2, so the day must survive a round trip
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = Date.parse(value);
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

export default app;
