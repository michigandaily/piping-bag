import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { SchedulerClient } from "@aws-sdk/client-scheduler";

import {
  load_config,
  fatal_error,
  get_aws_role,
  get_aws_credentials,
} from "./lib/helpers/_utils.js";
import type { Options } from "./lib/helpers/types.js";
import {
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  DEFAULT_PIPE_ROLE,
  DEFAULT_SCHEDULER_ROLE,
  MEMSIZE,
  TIMEOUT,
} from "./lib/helpers/_defaults.js";
import { convertSchedulerDate } from "./lib/helpers/_time.js";

import { bundleHandlers, uploadFunction } from "./lib/cli/upload.js";
import { attachScheduler } from "./lib/cli/schedule.js";

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;
  const { name, region = DEFAULT_REGION, profile } = config;
  const {
    handler,
    path,
    zip_dir,
    mem_size = MEMSIZE.DEFAULT,
    timeout = TIMEOUT.DEFAULT,
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
    region,
    credentials,
  });

  let arn: string;
  try {
    const lambdaDir = await bundleHandlers({ path, handler, zip_dir }, config);
    const code = readFileSync(lambdaDir);

    const pipeRole = await get_aws_role(
      roleClient,
      pipe_role,
      DEFAULT_PIPE_ROLE,
    );

    const lambdaClient = new LambdaClient({
      region: region,
      credentials,
    });

    const [_, res] = await uploadFunction(
      { name, role: pipeRole, region, handler, mem_size, timeout, code },
      lambdaClient,
    );

    arn = res!.FunctionArn!;
  } catch (error: any) {
    fatal_error(error);
  }

  try {
    const schedulerRole = await get_aws_role(
      roleClient,
      scheduler_role,
      DEFAULT_SCHEDULER_ROLE,
    );
    const schedulerClient = new SchedulerClient({ region, credentials });

    await attachScheduler(
      {
        arn: arn!,
        name,
        role: schedulerRole,
        region: region,
        start: convertSchedulerDate(start, timezone),
        end: convertSchedulerDate(end, timezone),
        rate,
        enable: true,
      },
      schedulerClient,
    );
  } catch (error: any) {
    fatal_error(error);
  }
};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program.option("-c, --config <path>", "path to config file").parse();

  main(program.args, program.opts());
}
