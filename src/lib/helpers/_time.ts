import { Temporal } from "@js-temporal/polyfill";
import type { SchedulerDate } from "./types.js";

export function currentUnix() {
  return Temporal.Now.instant().epochMilliseconds;
}

export function toUnix(
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

  return zdt.toInstant().epochMilliseconds;
}

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
