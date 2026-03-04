import { defineConfig } from "sink";

export default defineConfig({
  deployment: {
    name: "scraper",
    handler: "handler",
    region: "us-east-2",
    path: "./src/scraper.js",
    zip_dir: "./tmp",
    profile: "pipe",
  },
});
