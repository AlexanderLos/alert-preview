import type { Upstash } from "./redis.js";

// Requests one IP can make a minute. Every hub with every preset is 12, and 30
// leaves room for date picks and a few people sharing an IP.
export const LIMIT = 30;
const WINDOW_SECONDS = 60;

// Returns how many seconds the IP has to wait, or undefined if it can go
// ahead. Without Redis or an IP (both missing locally), or when Redis fails,
// every request goes ahead.
// ponytail: fixed window, so a burst across the minute boundary can reach
// 2x LIMIT; switch to a sliding window if that matters.
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
