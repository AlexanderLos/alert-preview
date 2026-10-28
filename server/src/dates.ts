// en-CA formats dates as YYYY-MM-DD
export function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());
}

const DAY_MS = 24 * 60 * 60 * 1000;
export function yesterdayCT(): string {
  const parsedToday = Date.parse(todayCT());
  const yesterdayMs = parsedToday - DAY_MS;
  const yesterday = new Date(yesterdayMs).toISOString().slice(0, 10);
  return yesterday;
}
