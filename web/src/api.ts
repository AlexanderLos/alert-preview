// The /api/prices fields the app uses
export type PriceReading = {
  interval_start_utc: string;
  interval_start_local: string;
  spp: number;
};

export async function fetchPrices(
  location: string,
  start: string,
  end: string,
): Promise<PriceReading[]> {
  const response = await fetch(
    `/api/prices?${new URLSearchParams({ location, start, end })}`,
  );
  if (!response.ok) {
    throw new Error(`/api/prices responded ${response.status}`);
  }
  return response.json();
}
