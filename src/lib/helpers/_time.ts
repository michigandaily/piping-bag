import { Temporal } from "@js-temporal/polyfill";
import type { SchedulerDate } from "./types.js";
import { DEFAULT_TIMEZONE } from "./_defaults.js";

export function currentUnix(timeZone: string = DEFAULT_TIMEZONE) {
  const now = Temporal.Now.zonedDateTimeISO(timeZone);
  return now.toInstant().epochMilliseconds;
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
