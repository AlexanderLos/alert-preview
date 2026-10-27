const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const usdShort = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// "$1,118.42"
export function formatUsd(value: number): string {
  return usd.format(value);
}

// "$100", "$100.5"
export function formatUsdShort(value: number): string {
  return usdShort.format(value);
}

// "Oct 5, 7:45 PM" in Central Time
export function formatTime(utc: string): string {
  return time.format(new Date(utc));
}
