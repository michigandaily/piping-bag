import { fileURLToPath } from "node:url";

import { Argument, program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";
import {
  CreateScheduleCommand,
  GetScheduleCommand,
  SchedulerClient,
  UpdateScheduleCommand,
  type CreateScheduleCommandInput,
  type UpdateScheduleCommandInput,
} from "@aws-sdk/client-scheduler";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import {
  fatal_error,
  get_aws_credentials,
  get_aws_role,
  load_config,
  success,
} from "./_utils.js";
import {
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  DEFAULT_SCHEDULER_ROLE,
} from "./_defaults.js";
import { convertSchedulerDate } from "./_time.js";
import type { Options } from "./types.js";

type ScheduleCommandInput = CreateScheduleCommandInput &
  UpdateScheduleCommandInput;

export async function attachScheduler(
  {
    arn,
    name,
    role,
    region,
    start,
    end,
    rate,
  }: {
    arn: string;
    name: string;
    role: string;
    region: string;
    start: Date;
    end: Date;
    rate: string;
  },
  credentials: AwsCredentialIdentityProvider,
) {
  console.log(`Attaching EventBridge Scheduler for deployed function ${name}`);
  const schedulerClient = new SchedulerClient({ region, credentials });
  const schedulerName = `${name}-${region}-schedule`;

  const exists = await schedulerClient
    .send(new GetScheduleCommand({ Name: schedulerName }))
    .then(
      () => true,
      (error) => {
        if (error.name === "ResourceNotFoundException") {
          return false;
        }
        fatal_error(error);
      },
    );

  const params: ScheduleCommandInput = {
    Name: schedulerName,
    ScheduleExpression: rate,
    StartDate: start,
    EndDate: end,
    Target: {
      Arn: arn,
      RoleArn: role,
    },
    FlexibleTimeWindow: { Mode: "OFF" },
  };

  let command;
  if (exists) {
    command = new UpdateScheduleCommand(params);
  } else {
    command = new CreateScheduleCommand(params);
  }

  const res = await schedulerClient.send(command);
  success(
    `Successfully attached scheduler ${res?.ScheduleArn} running from ${start.toString()} to ${end.toString()} at a schedule of ${rate} for ${name}`,
  );

  return res;
}

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const { name, region = DEFAULT_REGION, profile } = config.deployment;
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
    .addArgument(
      new Argument(
        "<liveness>",
        "activate or deactivate created schedule",
      ).choices(["enable, disable"]),
    )
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}
