import { fileURLToPath } from "node:url";
import { program } from "commander";

import { IAMClient } from "@aws-sdk/client-iam";
import { CreateScheduleCommand, GetScheduleCommand, SchedulerClient, UpdateScheduleCommand, type CreateScheduleCommandInput, type UpdateScheduleCommandInput } from "@aws-sdk/client-scheduler";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";

import { fatal_error, get_aws_credentials, get_aws_role, load_config } from "./_utils.js";
import type { Options } from "./types.js";
import { DEFAULT_REGION, DEFAULT_SCHEDULER_ROLE } from "./_defaults.js";

type ScheduleCommandInput = CreateScheduleCommandInput & UpdateScheduleCommandInput

export async function attachScheduler({ arn, name, role, region, start, end, rate }:
  { arn: string, name: string, role: string, region: string, start: Date, end: Date, rate: string }) {
  const schedulerClient = new SchedulerClient({ region })
  const schedulerName = `${name}-${region}-schedule`;

  const exists = await schedulerClient.send(
    new GetScheduleCommand({ Name: schedulerName })).then(() => true,
      (error) => {
        if (error.name === "ScheduleNotFoundException") {
          return false;
        }
        fatal_error(error);
      },
    )

  const params: ScheduleCommandInput = {
    Name: schedulerName,
    ScheduleExpression: rate,
    StartDate: start,
    EndDate: end,
    Target: {
      Arn: arn,
      RoleArn: role,
    },
    FlexibleTimeWindow: { Mode: 'OFF' }
  }

  try {
    let command;
    if (exists) {
      command = new UpdateScheduleCommand(params);
    } else {
      command = new CreateScheduleCommand(params);
    }
    return await schedulerClient.send(command);
  } catch (error: any) {
    fatal_error(error)
  }
}

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const { name, region, profile } = config.deployment;
  const { start, end, rate, scheduler_role } = config.schedule;

  const credentials = await get_aws_credentials(profile);
  const lambdaClient = new LambdaClient({ region: region ?? DEFAULT_REGION, credentials });
  const roleClient = new IAMClient({ region: region ?? DEFAULT_REGION, credentials })

  const command = new GetFunctionCommand({ FunctionName: name });
  const arn = await lambdaClient.send(command).then(
    ({ Configuration }) => {
      if (Configuration?.FunctionArn) {
        return Configuration.FunctionArn
      }
      throw Error("piping-bag error: Fetched invalid configuration or functionArn.")
    },
    (error) => {
      fatal_error(error);
    },
  );

  const schedulerRole = await get_aws_role(roleClient, scheduler_role, DEFAULT_SCHEDULER_ROLE);
  await attachScheduler({
    arn: arn!,
    name,
    role: schedulerRole,
    region: region ?? DEFAULT_REGION,
    start,
    end,
    rate
  })
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}

