import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/config.ts",
    "src/pipe.ts",
    "src/pipe-deploy.ts",
    "src/pipe-upload.ts",
    "src/pipe-schedule.ts",
    "src/pipe-list.ts",
    "src/pipe-destroy.ts",
    "src/lib/schema.ts",
    "src/types.ts",
  ],
  format: ["esm"],
  external: ["commander"],
  dts: true,
  clean: true,
  platform: "node",
});
