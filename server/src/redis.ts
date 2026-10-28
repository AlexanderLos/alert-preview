import { Redis } from "@upstash/redis";

// The client, and a logger that keeps its token out of the logs
export type Upstash = {
  redis: Redis;
  logError(failure: string, error: unknown): void;
};

// The Upstash integration on Vercel sets these env vars. Without Redis, prices
// are cached in memory and nothing is rate limited.
export function createUpstash(): Upstash | undefined {
  // A pasted newline would break the URL and slip past the token redaction
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    console.warn(
      "No Upstash env vars, so prices are cached in memory and nothing is rate limited",
    );
    return undefined;
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
      "KV_REST_API_URL isn't an Upstash REST URL, so prices are cached in memory and nothing is rate limited",
    );
    return undefined;
  }

  return {
    redis,
    // Upstash puts the whole command in its message, which for a write is every
    // reading, and fetch puts a token it can't send in its own
    logError: (failure, error) => {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      const message = String(cause).replaceAll(token, "<token>").slice(0, 200);
      console.error(`${failure} (${message})`);
    },
  };
}
