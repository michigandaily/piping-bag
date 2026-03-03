import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/config.ts",
    "src/pipe.ts",
    "src/pipe-deploy.ts",
    "src/lib/schema.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
});
