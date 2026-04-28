import { program } from "commander";
import { fileURLToPath } from "node:url";
import type { Options } from "./types.js";

const main = async ([], opts: Options) => {};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}
