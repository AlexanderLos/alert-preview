import { serve } from '@hono/node-server'
import app from './app.js'

// Local dev server only; Vercel runs app.ts directly
serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
