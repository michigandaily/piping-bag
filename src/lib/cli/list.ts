import {
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { GetScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import { info } from "../helpers/_utils.js";

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

  info(JSON.stringify(lambdaDetails))
  info(JSON.stringify(lambdaConfigDetails))
  info(JSON.stringify(scheduleDetails))

}
