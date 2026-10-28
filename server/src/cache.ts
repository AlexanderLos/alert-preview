import type { PriceQuery, PriceReading } from "./gridapi.js";
import { todayCT, yesterdayCT } from "./dates.js";
import type { Upstash } from "./redis.js";

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

export function createCache(upstash: Upstash | undefined): PriceCache {
  if (!upstash) {
    return memoryCache();
  }
  const { redis, logError } = upstash;

  return {
    get: (key) =>
      redis.get<PriceReading[]>(key).catch((error) => {
        logError(`cache read failed for ${key}`, error);
        return null;
      }),
    set: async (key, readings, expirySeconds) => {
      const options =
        expirySeconds === undefined ? undefined : { ex: expirySeconds };
      await redis
        .set(key, readings, options)
        .catch((error) => logError(`cache write failed for ${key}`, error));
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

// Bump v1 when PriceReading changes, so old cached entries are ignored
export function cacheKey(query: PriceQuery): string {
  return `spp:v1:${query.location}|${query.start}|${query.end}`;
}

// Ranges ending today or yesterday may still be missing their latest prices,
// so they expire in 15 minutes. Older ranges are final and never expire.
export function expirySeconds(query: PriceQuery): number | undefined {
  const today = todayCT();
  const yesterday = yesterdayCT();
  if (query.end === today || query.end === yesterday) {
    return 15 * 60;
  }
  return undefined;
}
