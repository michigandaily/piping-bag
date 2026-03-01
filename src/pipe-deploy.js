import { fileURLToPath } from "node:url";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  createReadStream,
  createWriteStream,
} from "node:fs";
import { createGzip } from "node:zlib";

import { program } from "commander";

import { LambdaClient } from "@aws-sdk/client-lambda";

import { fatal_error, load_config } from "./_utils.js";

const self = fileURLToPath(import.meta.url);

const main = async (opts) => {
  const { config } = await load_config(opts.config);
  const manualPrompt = opts.yes === undefined;

  const { path, zip_dir } = config.deployment;

  if (!path || path.length === 0) {
    fatal_error("File path is not defined in pipe configuration");
  }
  // TODO: Create a unique temporary filename that auto-cleans if zip destination path is not defined
  if (!zip_dir || path.length === 0)
    [
      fatal_error(
        "Zip directory destination path is not defined in pipe configuration",
      ),
    ];

  if (!existsSync(path)) {
    fatal_error("File path defined in pipe configuration does not exist.");
  }

  if (!existsSync(zip_dir)) {
    mkdirSync(zip_dir, { recursive: true });
  }

  const file = createReadStream(path);
  const zipFilename = `${path.split("/").at(-1)}.gz`;
  const writeStream = createWriteStream(`${zip_dir}/${zipFilename}`);

  file
    .pipe(createGzip())
    .pipe(writeStream)
    .on("finish", (err) => {
      if (err) {
        fatal_error(err);
      }
    });
};

if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .option("-y, --yes", "answer yes to prompts")
    .parse();

  main(program.args, program.opts());
}
