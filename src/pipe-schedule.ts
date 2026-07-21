import { fileURLToPath } from "node:url";

import { Argument, program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";

import {
  fatal_error,
  get_aws_credentials,
  get_aws_role,
  load_config,
} from "./lib/helpers/_utils.js";
import {
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  DEFAULT_SCHEDULER_ROLE,
} from "./lib/helpers/_defaults.js";
import { convertSchedulerDate } from "./lib/helpers/_time.js";
import type { Options } from "./lib/helpers/types.js";

import { attachScheduler } from "./lib/cli/schedule.js";
import { SchedulerClient } from "@aws-sdk/client-scheduler";

const main = async (args: string[], opts: Options) => {
  const [liveness] = args;
  const { config } = (await load_config(opts.config))!;

  const { name, region = DEFAULT_REGION, profile } = config;
  const {
    start,
    end,
    rate,
    scheduler_role,
    timezone = DEFAULT_TIMEZONE,
  } = config.schedule;

  const credentials = await get_aws_credentials(profile);
  const lambdaClient = new LambdaClient({
    region: region,
    credentials,
  });
  const roleClient = new IAMClient({
    region: region,
    credentials,
  });

  const command = new GetFunctionCommand({ FunctionName: name });
  const arn = await lambdaClient.send(command).then(
    ({ Configuration }) => {
      if (Configuration?.FunctionArn) {
        return Configuration.FunctionArn;
      }
      throw Error(
        "piping-bag error: Fetched invalid configuration or functionArn.",
      );
    },
    (error) => {
      fatal_error(error);
    },
  );

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
        enable: liveness != "disable",
      },
      schedulerClient,
    );
  } catch (error: any) {
    fatal_error(error);
  }
};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program
    .addArgument(
      new Argument(
        "<liveness>",
        "activate or deactivate created schedule",
      ).choices(["enable", "disable"]),
    )
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}
