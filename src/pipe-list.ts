import { program } from "commander";

import { fileURLToPath } from "node:url";

import {
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { GetScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import {
  fatal_error,
  get_aws_credentials,
  info,
  load_config,
} from "./_utils.js";
import type { Options } from "./types.js";
import { DEFAULT_REGION } from "./_defaults.js";

export async function listResources(
  { name, region }: { name: string; region: string },
  credentials: AwsCredentialIdentityProvider,
) {
  const lambdaClient = new LambdaClient({
    region: region,
    credentials,
  });
  const command = new GetFunctionCommand({ FunctionName: name });
  const configCommand = new GetFunctionConfigurationCommand({
    FunctionName: name,
  });

  const lambdaDetails = await lambdaClient.send(command).then(
    (res) => res,
    (error) => {
      if (error.name === "ResourceNotFoundException") {
        return undefined;
      }
      throw Error(error);
    },
  );

  const lambdaConfigDetails = await lambdaClient.send(configCommand).then(
    (res) => res,
    (error) => {
      if (error.name === "ResourceNotFoundException") {
        return undefined;
      }
      throw Error(error);
    },
  );

  const schedulerClient = new SchedulerClient({ region, credentials });
  const schedulerName = `${name}-${region}-schedule`;

  const scheduleDetails = await schedulerClient
    .send(new GetScheduleCommand({ Name: schedulerName }))
    .then(
      (res) => res,
      (error) => {
        if (error.name === "ResourceNotFoundException") {
          return undefined;
        }
        throw Error(error);
      },
    );

  info(
    "Expecting an output printing out all existing remote resources deployed on AWS :)",
  );
}

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
