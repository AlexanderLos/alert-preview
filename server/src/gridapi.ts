export class gridAPI {
  constructor(private readonly apiKey: string) {}

  private static readonly baseURL =
    "https://api.gridstatus.io/v1/datasets/ercot_spp_real_time_15_min/query";

  // Saved results for each location and date range, kept until the server restarts
  private readonly cache = new Map<string, PriceReading[]>();

  async fetchPrices(query: PriceQuery): Promise<PriceResponse> {
    try {
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

      const response = await fetch(url, {
        headers: { "x-api-key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`GridStatus request failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async fetchAllPrices(query: PriceQuery): Promise<PriceReading[]> {
    const key = `${query.location}|${query.start}|${query.end}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const readings: PriceReading[] = [];
    let cursor: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await this.fetchPrices({ ...query, cursor });
      readings.push(...response.data);
      hasNextPage = response.meta.hasNextPage;
      cursor = response.meta.cursor ?? undefined;
    }

    this.cache.set(key, readings);
    return readings;
  }
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

export type PriceResponse = {
  data: PriceReading[];
  meta: { hasNextPage: boolean; cursor?: string | null };
};

export type PriceQuery = {
  location: string;
  start: string;
  end: string;
  cursor?: string;
};
