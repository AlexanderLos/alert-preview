# Alert Preview

[![ci](https://github.com/AlexanderLos/alert-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexanderLos/alert-preview/actions/workflows/ci.yml)

See how often an ERCOT price alert would have fired on past data. Pick a hub, a price and a notification timeout to see every notification the alert would have sent and every reading its timeout suppressed.

Live: https://alert-preview.vercel.app

The design is in [docs/design/alert-preview-mockup.html](docs/design/alert-preview-mockup.html). Open it in a browser.

## Run it locally

You need Node 20.19 or later and a Grid Status API key.

1. Create `server/.env`:

   ```
   GRIDSTATUS_API_KEY=...
   ```

2. Start the API on port 3000:

   ```sh
   cd server
   npm install
   npm run dev
   ```

3. In another terminal, start the web app. Vite proxies `/api` to port 3000.

   ```sh
   cd web
   npm install
   npm run dev
   ```

Run `npm test` in `server` and in `web` for the tests.

## Known limitations

- Only ERCOT's real-time 15-minute SPP, for 4 hubs.
- Up to 31 days per preview and no future dates. Times are in Central Time.
- The Grid Status free tier allows 1 request per second and 500k rows a month, so a busy moment shows the error state.
- On Vercel, prices are cached in Upstash Redis and shared by every instance.
- Locally, without `KV_REST_API_URL` and `KV_REST_API_TOKEN`, prices are cached in memory, so a range that includes today misses newer readings until the server restarts.
- `/api/prices` has no auth or rate limiting.
- It relies on Grid Status reading bare dates in market time (CT) with `timezone=market`, which its docs don't promise.

## Trade-offs

## How I used AI
