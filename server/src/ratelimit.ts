import type { Upstash } from "./redis.js";

// Requests per IP per minute. Trying all 4 hubs with all 3 date presets is 12,
// so 30 leaves room for custom dates and a few people sharing an IP.
export const LIMIT = 30;
// ponytail: counts reset on each clock minute, so a burst across the boundary
// can get 2x LIMIT through. Count a rolling 60 seconds if that matters.
const WINDOW_SECONDS = 60;

// Returns seconds to wait, or undefined to allow the request. Also allows it
// when Redis is off or down, or there's no IP (local dev sends no x-real-ip).
export async function rateLimit(
  upstash: Upstash | undefined,
  ip: string | undefined,
): Promise<number | undefined> {
  if (!upstash || !ip) {
    return undefined;
  }
  const now = Date.now() / 1000;
  const window = Math.floor(now / WINDOW_SECONDS);
  const key = `ratelimit:${ip}:${window}`;

  try {
    const [count] = await upstash.redis
      .pipeline()
      .incr(key)
      .expire(key, WINDOW_SECONDS)
      .exec<[number, number]>();
    return count > LIMIT
      ? Math.ceil((window + 1) * WINDOW_SECONDS - now)
      : undefined;
  } catch (error) {
    upstash.logError(`rate limit check failed for ${ip}`, error);
    return undefined;
  }
}
