import { defineConfig } from "sink";

export default defineConfig({
  deployment: {
    path: "./src/scraper.js",
    zip: "./tmp",
    profile: "pipe",
  },
});
