import { defineConfig, defineSchedulerDate } from "piping-bag";

export default defineConfig({
  deployment: {
    name: "scraper",
    handler: "scraper.handler",
    region: "us-east-2", // optional
    path: "./src/scraper.js",
    zip_dir: "./tmp",
    mem_size: 512, // 512 GB, optional
    timeout: 10, // 10 seconds, optional
    profile: "pipe",
    pipe_role: "pipe-lambda",
  },
  schedule: {
    start: defineSchedulerDate({
      hour: 9, // 9 AM
      day: 1, // 1st
      month: 1, // January
      year: 2027,
    }),
    end: defineSchedulerDate({
      hour: 21, // 9 PM
      day: 2, // 2nd
      month: 1, // January
      year: 2027,
    }),
    rate: "rate(5 minutes)",
    // rate: 'cron(0 12 * * ? *)' // you can also use cron expressions
    timezone: "America/Detroit", // default timezone is America/Detroit if not specified
    scheduler_role: "pipe-eventbridge",
  },
  schema: {
    bucket: "stash.michigandaily.com",
  },
});
