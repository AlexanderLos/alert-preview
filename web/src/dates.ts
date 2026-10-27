import dayjs from "dayjs";

// Same limit as the server
const MAX_DAYS = 31;

// en-CA formats dates as YYYY-MM-DD
export function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());
}

export function presets(today: string) {
  const day = dayjs(today);
  const lastYear = day.subtract(1, "year");
  return [
    {
      label: "Last 7 days",
      start: format(day.subtract(7, "day")),
      end: format(day.subtract(1, "day")),
    },
    {
      label: "Last 30 days",
      start: format(day.subtract(30, "day")),
      end: format(day.subtract(1, "day")),
    },
    {
      label: "Same month last year",
      start: format(lastYear.startOf("month")),
      end: format(lastYear.endOf("month")),
    },
  ];
}

// Returns what's wrong with the range, or undefined if it's valid
export function rangeError(start: string, end: string): string | undefined {
  if (end < start) {
    return "End date is before start date.";
  }
  if (dayjs(end).diff(start, "day") + 1 > MAX_DAYS) {
    return `Pick ${MAX_DAYS} days or fewer.`;
  }
}

function format(day: dayjs.Dayjs): string {
  return day.format("YYYY-MM-DD");
}
