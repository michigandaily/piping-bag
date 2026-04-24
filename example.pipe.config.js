import { defineConfig } from "piping-bag";

export default defineConfig({
  deployment: {
    name: "scraper",
    handler: "scraper.handler",
    region: "us-east-2",
    path: "./src/scraper.js",
    zip_dir: "./tmp",
    profile: "pipe",
    pipe_role: "pipe-lambda",
  },
  schedule: {
    start: new Date(),
    end: new Date(),
    rate: "rate(5 minutes)",
    // rate: 'cron(0 12 * * ? *)' // you can also use cron expressions
    scheduler_role: "pipe-eventbridge",
  },
});
