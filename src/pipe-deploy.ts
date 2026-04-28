import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";

import {
  load_config,
  fatal_error,
  get_aws_role,
  get_aws_credentials,
} from "./_utils.js";
import type { Options } from "./types.js";
import {
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  DEFAULT_PIPE_ROLE,
  DEFAULT_SCHEDULER_ROLE,
} from "./_defaults.js";
import { convertSchedulerDate } from "./_time.js";

import { attachScheduler } from "./pipe-schedule.js";
import { bundleHandlers, uploadFunction } from "./pipe-upload.js";

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
  const {
    start,
    end,
    rate,
    scheduler_role,
    timezone = DEFAULT_TIMEZONE,
  } = config.schedule;

  const credentials = await get_aws_credentials(profile);

  const roleClient = new IAMClient({
    region: region,
    credentials,
  });

  let arn: string;
  try {
    const lambdaDir = await bundleHandlers({ path, handler, zip_dir });
    const code = readFileSync(lambdaDir);

    const pipeRole = await get_aws_role(
      roleClient,
      pipe_role,
      DEFAULT_PIPE_ROLE,
    );

    const res = await uploadFunction(
      { name, role: pipeRole, region, handler, code },
      credentials,
    );

    arn = res.FunctionArn!;
  } catch (error: any) {
    fatal_error(error);
  }

  try {
    const schedulerRole = await get_aws_role(
      roleClient,
      scheduler_role,
      DEFAULT_SCHEDULER_ROLE,
    );
    await attachScheduler(
      {
        arn: arn!,
        name,
        role: schedulerRole,
        region: region,
        start: convertSchedulerDate(start, timezone),
        end: convertSchedulerDate(end, timezone),
        rate,
      },
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
