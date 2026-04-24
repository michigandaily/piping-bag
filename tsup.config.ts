import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/config.ts",
    "src/pipe.ts",
    "src/pipe-deploy.ts",
    "src/pipe-schedule.ts",
    "src/lib/schema.ts",
    "src/types.ts",
  ],
  format: ["cjs", "esm"],
  external: ["commander"],
  dts: true,
  clean: true,
  platform: "node",
});
