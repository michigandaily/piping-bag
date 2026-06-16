import type { Config, SchedulerDate } from "./lib/helpers/types.js";

/**
 * Defines the piping-bag configuration in pipe.config.js.
 * @param configuration - The full configuration defined in a Javascript JSON Object.
 * @param configuration.name - The name of the piping-bag pipeline, used as an id in all remote resources.
 * @param configuration.region - The AWS region for all piping-bag remote resources.
 * @param configuration.profile - The AWS credentials profile to use.
 * @param configuration.deployment - All configurations involved in deploying a remote AWS Lambda script.
 * @param configuration.deployment.handler - The lambda handler function (ex: scraper.main, where scraper.js is the file and main is the function)
 * @param configuration.deployment.path - The where to find the script to deploy.
 * @param configuration.deployment.zip_dir - The directory to place intermediate deployment bundles such as esbuild results and compressed files.
 * @param configuration.deployment.mem_size - The memory allocated for the remote AWS Lambda.
 * @param configuration.deployment.timeout - The time allowed for the remote AWS Lambda to run before it exits.
 * @param configuration.deployment.pipe_role - The AWS IAM role to give the AWS remote lambda. By default uses pipe-lambda.
 * @param configuration.schedule - All configurations involved in deploying a remote AWS Schedule.
 * @param configuration.schedule.start - The start date of running the remote lambda script.
 * @param configuration.schedule.end - The end date of running the remote lambda script.
 * @param configuration.timezone - The specified timezone of the start and end dates.
 * @param configuration.schedule.rate - The interval rate at which the lambda script runs during the scheduled time.
 * @param configuration.scheduler_role - The AWS IAM role to give the AWS remote schedule. By default uses pipe-eventbridge.
 * @param configuration.schema - All configurations involved in creating a remote AWS S3 storage directory.
 * @param configuration.schema.bucket - The S3 bucket where data will be written to and fetched from.
 */
export function defineConfig(configuration: Config) {
  return configuration;
}

/**
 * Defines a SchedulerDate type in pipe.config.js.
 */
export function defineSchedulerDate(date: SchedulerDate) {
  return date;
}
