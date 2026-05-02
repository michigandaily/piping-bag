import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";

import {
  load_config,
  fatal_error,
  get_aws_role,
  get_aws_credentials,
} from "./lib/helpers/_utils.js";
import type { Options } from "./lib/helpers/types.js";
import { DEFAULT_REGION, DEFAULT_PIPE_ROLE } from "./lib/helpers/_defaults.js";

import { bundleHandlers, uploadFunction } from "./lib/cli/upload.js";

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const {
    name,
    region = DEFAULT_REGION,
    handler,
    path,
    zip_dir,
    profile,
    pipe_role,
  } = config.deployment;

  const credentials = await get_aws_credentials(profile);

  const roleClient = new IAMClient({
    region: region,
    credentials,
  });

  try {
    const lambdaDir = await bundleHandlers({ path, handler, zip_dir });
    const code = readFileSync(lambdaDir);

    const pipeRole = await get_aws_role(
      roleClient,
      pipe_role,
      DEFAULT_PIPE_ROLE,
    );

    await uploadFunction(
      { name, role: pipeRole, region, handler, code },
      credentials,
    );
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
