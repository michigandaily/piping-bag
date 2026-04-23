import { fileURLToPath } from "node:url";
import { program } from "commander";

import { CreateScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";

import { fatal_error, load_config } from "./_utils.js";
import type { Options } from "./types.js";
import { DEFAULT_REGION } from "./_defaults.js";

export async function attachScheduler({ arn, region, start, end, rate }:
  { arn: string, region: string, start: Date, end: Date, rate: string }) {
  const schedulerClient = new SchedulerClient({ region })
  try {
    const res = await schedulerClient.send(new CreateScheduleCommand({
      Name: `${arn}-schedule`,
      ScheduleExpression: rate,
      StartDate: start,
      EndDate: end,
      Target: {
        Arn: arn,
        RoleArn: process.env.SCHEDULER_PERMISSIONS, // IAM role that allows scheduler to invoke Lambda
      },
      FlexibleTimeWindow: { Mode: 'OFF' }
    }))
  } catch (error: any) {
    fatal_error(error)
  }
}

const self = fileURLToPath(import.meta.url);
const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const { name, region, profile } = config.deployment;
  const { start, end, rate } = config.schedule;

  const lambdaClient = new LambdaClient({
    region: region ?? DEFAULT_REGION,
    profile,
  });
  const command = new GetFunctionCommand({ FunctionName: name });
  const arn = await lambdaClient.send(command).then(
    ({ Configuration }) => {
      if (Configuration?.FunctionArn) {
        return Configuration.FunctionArn
      } else {
        throw Error("piping-bag error: Fetched invalid configuration or functionArn.")
      }
    },
    (err) => {
      fatal_error(err);
    },
  );

  await attachScheduler({ arn: arn!, region: region ?? DEFAULT_REGION, start, end, rate })
}
if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}

