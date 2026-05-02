import { Temporal } from "@js-temporal/polyfill";
import type { SchedulerDate } from "./types.js";

export function convertSchedulerDate(
  { hour, day, month, year }: SchedulerDate,
  timeZone: string,
) {
  const now = Temporal.Now.zonedDateTimeISO(timeZone);

  const zdt = Temporal.ZonedDateTime.from({
    hour,
    day,
    month: month ?? now.month,
    year: year ?? now.year,
    timeZone,
  });

  return new Date(zdt.toInstant().epochMilliseconds);
}
