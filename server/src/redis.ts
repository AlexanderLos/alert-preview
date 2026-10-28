import { Redis } from "@upstash/redis";

// The client, and a logger that keeps its token out of the logs
export type Upstash = {
  redis: Redis;
  logError(failure: string, error: unknown): void;
};

// The Upstash integration on Vercel sets these env vars
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
      // Give up fast: one try, 2s. signal is a function so each call gets a new
      // timer; one signal would expire 2s after startup and abort every call.
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
    // Upstash errors quote the whole command (every reading, on a cache write),
    // and fetch errors quote a token that has a newline, so shorten and redact
    logError: (failure, error) => {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      const message = String(cause).replaceAll(token, "<token>").slice(0, 200);
      console.error(`${failure} (${message})`);
    },
  };
}
