import { cacheKey, expirySeconds, type PriceCache } from "./cache.js";

export class gridAPI {
  constructor(
    private readonly apiKey: string,
    private readonly cache: PriceCache,
  ) {}

  private static readonly baseURL =
    "https://api.gridstatus.io/v1/datasets/ercot_spp_real_time_15_min/query";

  async fetchPrices(query: PriceQuery): Promise<PriceResponse> {
    const url = new URL(gridAPI.baseURL);
    url.searchParams.set("filter_value", query.location);
    url.searchParams.set("start_time", query.start);
    // Grid Status's end_time is exclusive, so ask for the day after the last day
    url.searchParams.set("end_time", dayAfter(query.end));
    url.searchParams.set("timezone", "market");
    url.searchParams.set("filter_column", "location");
    if (query.cursor) {
      url.searchParams.set("cursor", query.cursor);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-api-key": this.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new GridStatusError(
          504,
          "Grid Status took too long to respond.",
          "timeout after 10s",
        );
      }
      // Node keeps the network error (DNS, refused, TLS) in cause. A key with a
      // control character makes fetch throw with the key in the message.
      const cause = error instanceof Error && error.cause ? error.cause : error;
      throw new GridStatusError(
        502,
        "Couldn't reach Grid Status.",
        String(cause).replaceAll(this.apiKey, "<key>"),
      );
    }

    if (!response.ok) {
      throw await responseError(response);
    }
    return await response.json();
  }

  // pages is how many requests went to Grid Status, 0 when the cache answered
  async fetchAllPrices(
    query: PriceQuery,
  ): Promise<{ readings: PriceReading[]; pages: number }> {
    const key = cacheKey(query);
    const cached = await this.cache.get(key);
    if (cached) {
      return { readings: cached, pages: 0 };
    }

    const readings: PriceReading[] = [];
    let cursor: string | undefined = undefined;
    let hasNextPage = true;
    let pages = 0;

    while (hasNextPage) {
      const response = await this.fetchPrices({ ...query, cursor });
      pages++;
      readings.push(...response.data);
      hasNextPage = response.meta.hasNextPage;
      cursor = response.meta.cursor ?? undefined;
    }

    await this.cache.set(key, readings, expirySeconds(query));
    return { readings, pages };
  }
}

// message is safe to send to clients; reason is for the logs only
export class GridStatusError extends Error {
  constructor(
    readonly status: 502 | 503 | 504,
    message: string,
    readonly reason: string,
  ) {
    super(message);
  }
}

async function responseError(response: Response): Promise<GridStatusError> {
  // Grid Status errors are { "detail": "..." }, but the body may not be JSON
  const body = await response.json().catch(() => undefined);
  const detail =
    typeof body?.detail === "string" ? body.detail : response.statusText;
  const reason = `Grid Status ${response.status}: ${detail}`;

  // Grid Status answers a bad key with 400 "Invalid API key."
  if ([400, 401, 403].includes(response.status)) {
    return new GridStatusError(
      502,
      "Grid Status rejected the server's API key or plan.",
      reason,
    );
  }
  // Both the per-second rate limit and the monthly row limit
  if (response.status === 429) {
    return new GridStatusError(
      503,
      "Grid Status limit reached. Try again later.",
      reason,
    );
  }
  if (response.status >= 500) {
    return new GridStatusError(
      502,
      "Grid Status is unavailable right now.",
      reason,
    );
  }
  return new GridStatusError(502, "Grid Status rejected the request.", reason);
}

// YYYY-MM-DD parses as UTC midnight, so adding a day can't hit daylight saving
function dayAfter(date: string): string {
  const day = new Date(date);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

//Price Types

export type PriceReading = {
  interval_start_local: string;
  interval_start_utc: string;
  interval_end_local: string;
  interval_end_utc: string;
  location: string;
  location_type: string;
  market: string;
  spp: number;
};

type PriceResponse = {
  data: PriceReading[];
  meta: { hasNextPage: boolean; cursor?: string | null };
};

export type PriceQuery = {
  location: string;
  start: string;
  end: string;
  cursor?: string;
};
