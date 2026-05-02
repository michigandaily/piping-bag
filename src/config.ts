import type { Config, SchedulerDate } from "./lib/helpers/types.js";
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
