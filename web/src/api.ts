// The /api/prices fields the app uses
export type PriceReading = {
  interval_start_utc: string;
  interval_start_local: string;
  spp: number;
};

// The server limits how many requests one IP can make a minute
class TooManyRequestsError extends Error {}

export async function fetchPrices(
  location: string,
  start: string,
  end: string,
): Promise<PriceReading[]> {
  const response = await fetch(
    `/api/prices?${new URLSearchParams({ location, start, end })}`,
  );
  if (response.status === 429) {
    throw new TooManyRequestsError();
  }
  if (!response.ok) {
    throw new Error(`/api/prices responded ${response.status}`);
  }
  return response.json();
}

export function loadErrorMessage(error: Error): string {
  return error instanceof TooManyRequestsError
    ? "Too many requests. Try again in a minute."
    : "Couldn't load prices from Grid Status.";
}
