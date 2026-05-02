import { program } from "commander";

import { fileURLToPath } from "node:url";

import {
  fatal_error,
  get_aws_credentials,
  load_config,
} from "./lib/helpers/_utils.js";
import type { Options } from "./lib/helpers/types.js";
import { DEFAULT_REGION } from "./lib/helpers/_defaults.js";

import { listResources } from "./lib/cli/list.js";

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const { name, region = DEFAULT_REGION, profile } = config.deployment;
  const credentials = await get_aws_credentials(profile);

  try {
    await listResources({ name, region }, credentials);
  } catch (error: any) {
    fatal_error(error);
  }
};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}
