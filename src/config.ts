import type { Config, SchedulerDate } from "./types.ts";
/**
 * @param {{
 *  deployment: {
 *  }
 * }} configuration
 */
export function defineConfig(configuration: Config) {
  return configuration;
}

export function defineSchedulerDate(date: SchedulerDate) {
  return date;
}
