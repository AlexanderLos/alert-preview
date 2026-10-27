import { Redis } from "@upstash/redis";
import type { PriceQuery, PriceReading } from "./gridapi.js";

// Where gridAPI keeps finished ranges. get resolves to null on a miss, and
// neither method rejects, because a cache failure only costs speed.
export type PriceCache = {
  get(key: string): Promise<PriceReading[] | null>;
  set(
    key: string,
    readings: PriceReading[],
    expirySeconds?: number,
  ): Promise<void>;
};

// The Upstash integration on Vercel sets these env vars
export function createCache(): PriceCache {
  // A pasted newline would break the URL and slip past the token redaction
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    return memoryCache();
  }

  let redis: Redis;
  try {
    redis = new Redis({
      url,
      token,
      // Give up fast: one attempt and 2s per request to Upstash. The signal is
      // a function so each request gets its own timer; a single signal would
      // expire 2s after startup and fail every request after that.
      retry: { retries: 0 },
      signal: () => AbortSignal.timeout(2_000),
    });
  } catch {
    // Upstash quotes the URL it rejects, and a redis:// URL holds a password
    console.error(
      "KV_REST_API_URL isn't an Upstash REST URL, so prices are cached in memory",
    );
    return memoryCache();
  }

  // Upstash puts the whole command in its message, which for a write is every
  // reading, and fetch puts a token it can't send in its own
  const logError = (action: "read" | "write", key: string, error: unknown) => {
    const cause = error instanceof Error && error.cause ? error.cause : error;
    const message = String(cause).replaceAll(token, "<token>").slice(0, 200);
    console.error(`cache ${action} failed for ${key} (${message})`);
  };

  return {
    get: (key) =>
      redis.get<PriceReading[]>(key).catch((error) => {
        logError("read", key, error);
        return null;
      }),
    set: async (key, readings, expirySeconds) => {
      const options =
        expirySeconds === undefined ? undefined : { ex: expirySeconds };
      await redis
        .set(key, readings, options)
        .catch((error) => logError("write", key, error));
    },
  };
}

// Kept until the server restarts, ignoring expiry
export function memoryCache(): PriceCache {
  const cache = new Map<string, PriceReading[]>();
  return {
    get: async (key) => cache.get(key) ?? null,
    set: async (key, readings) => {
      cache.set(key, readings);
    },
  };
}

// Placeholder for your key: the same key the in-memory cache used
export function cacheKey(query: PriceQuery): string {
  return `${query.location}|${query.start}|${query.end}`;
}

// Placeholder for your rule (ranges that include today expire, past ranges
// stay). Until then nothing expires, and unlike the old Map, Redis keeps a
// range across restarts and deploys, including one that ends today.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function expirySeconds(query: PriceQuery): number | undefined {
  return undefined;
}
