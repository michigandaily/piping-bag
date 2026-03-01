import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import chalk from "chalk";
import { findUp } from "find-up";
import "dotenv/config";

const _is_js_config = (filename) => {
  return filename.slice(-2) === "js";
};

export const read_json_config = (path) => {
  return { config: JSON.parse(readFileSync(path)) };
};

export const read_js_config = async (path) => {
  const config = (await import(pathToFileURL(path))).default;
  return { config };
};

export const has_filled_props = (o) => Object.values(o).every((v) => v.length);

export const is_dir = (dir) => statSync(dir).isDirectory();

// Search directory for configuration file
export const load_config = async (configFile = null) => {
  const defaults = [
    "pipe.config.js",
    "pipe.config.mjs",
    "pipe.config.cjs",
    "pipe.config.json",
  ];
  const searchFiles = configFile ? [configFile, ...defaults] : defaults;
  for (const searchFile of searchFiles) {
    const path = await findUp(searchFile);
    if (typeof path === "undefined") continue;
    if (_is_js_config(path)) {
      return await read_js_config(path);
    }
    return read_json_config(path);
  }
  fatal_error("Could not load config file");
};

export const write_file = (output, content) => {
  const dir = dirname(output);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(output, content);
};

export const fatal_error = (message) => {
  console.error(`${chalk.red("Fatal Error: ")} ${message}`);
  process.exit(1);
};

export const success = (message) => {
  console.log(chalk.green(message));
};
