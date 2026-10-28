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

// One entry per hub and date range. Bump v1 to ignore entries saved in an older shape.
export function cacheKey(query: PriceQuery): string {
  return `spp:v1:${query.location}|${query.start}|${query.end}`;
}

// Today, and yesterday just after midnight can still be missing prices,
// so those ranges expire in 15 minutes. Older ranges never change.

export function expirySeconds(query: PriceQuery): number | undefined {
  const today = todayCT();
  const yesterday = yesterdayCT();
  if (query.end === today || query.end === yesterday) {
    return 15 * 60; //Keeping it to 15 minutes since today is still filling in.
  }
  return undefined;
}
