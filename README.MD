# Alert Preview

[![ci](https://github.com/AlexanderLos/alert-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexanderLos/alert-preview/actions/workflows/ci.yml)

See how often an ERCOT price alert would have fired on past data. Pick a hub, a price and a notification timeout to see every notification the alert would have sent and every reading its timeout suppressed.

Live: https://alert-preview.vercel.app

## Run it locally

You need Node 20.19 or later and a Grid Status API key.

1. Create `server/.env`:

   ```
   GRIDSTATUS_API_KEY=...

   # Optional: cache in Upstash Redis instead of memory
   KV_REST_API_URL=...
   KV_REST_API_TOKEN=...
   ```

   Without the `KV_` vars, prices are cached in memory. The rate limit is always off locally.

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

   Then open the URL Vite prints, usually http://localhost:5173.

Run `npm test` in `server` and in `web` for the tests.

## Known limitations

- Only ERCOT's real-time 15-minute SPP, for 4 hubs.
- Up to 31 days per preview and no future dates. Times are in Central Time.
- The Grid Status free tier allows 1 request per second and 500k rows a month, so a busy moment shows the error state.
- Ranges ending today or yesterday can be up to 15 minutes behind.
- No login. Each visitor is limited to 30 requests a minute, which stops scripts but not someone using many IPs. The limit is off when running locally.
- It relies on Grid Status reading bare dates in market time (CT) with `timezone=market`, which its docs don't promise.

## Trade-offs

- **Alert math runs in the browser.** Sliders update instantly without hitting the server. Downside: the page loads every reading in the range, up to about 3,000.
- **TypeScript and Hono instead of FastAPI.** One language and shared types across the app. The server only fetches and caches, so it didn't need more.
- **One Vercel project for the page and the API.** Same URL, so no CORS, and every PR preview gets both.
- **GitHub Actions handles deploys.** Nothing deploys unless CI passes, and it's all visible in the repo. Downside: a Vercel token lives in GitHub secrets.
- **The Redis cache can't break the app.** Old prices never change, so they're kept forever. Today and yesterday expire after 15 minutes. If Redis goes down, requests still work.

## How I used AI

Built in focused sessions across the week.

- **Research:** Claude for Grid Status, its users and gaps. I confirmed the missing feature in the signed-in product myself.
- **API:** I explored the Grid Status API by hand in Bruno before writing any code.
- **Design:** a first mockup in ChatGPT, then Claude Design, using Grid Status's own alert terms.
- **Build:** Claude Code, plan mode first, then one PR at a time. Each PR had independent review agents, a skeptic checking their findings, and mutation checks (breaking each guard on purpose to prove a test catches it). I reviewed and merged every PR.
- **What I wrote myself:** the Grid Status fetch and its query params, and the cache key and expiry rule, including the midnight case.

**Where AI was wrong, and I corrected it:**

- It guessed the paging field was `has_next_page`. The real response uses `hasNextPage`.
- The plan used Node's test runner and capped the price at $500. I switched to Vitest and raised the cap to $5,000, ERCOT's offer cap.
- The first design came out dark. I asked for light, to match Grid Status.
- An early version ran the alert math on the server, so every slider move was a request. I moved it to the browser.
- It worked around a TypeScript 7 crash in Vercel's build. I pinned TypeScript 6 instead.

## What I'd do differently

I set up the tooling mostly by hand here: Node version, Prettier, ESLint, CI and gated deploys. It's the same on every project, so next time I'd start from a setup skill. This time I wanted to make each choice myself.

I also kept the AI tooling light on purpose. Typically I tend to use tools like Ponytail (which was used here), ECC, Agent Skills (by Addy Osmani), Worktrunk, and Open Whisper to work a lot faster, but for this take-home I wanted the repo to show what I prioritize, not just how fast an agent can go.

## What I'd build next

- **More operations:** "is less than or equal to" for negative-price alerts, and "crosses above" to notify once per spike instead of once per timeout.
- **More hubs and datasets support:** like ERCOT load in MW.
- **A "Use these settings" button:** creates the real alert in Grid Status.
- **A spike explainer:** a little bit more ambitious, but when an alert fires, show what moved with the price (load, net load, fuel mix) or any other data that supports a possible explanation.
