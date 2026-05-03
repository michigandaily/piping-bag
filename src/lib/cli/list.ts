import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
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

  const lambdaDetails = await lambdaClient.send(command).then(
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

  if (lambdaDetails) {
    info("Found remote lambda uploaded:");
    console.table(lambdaDetails, [
      "FunctionName",
      "Handler",
      "Runtime",
      "Timeout",
      "MemorySize",
      "EphemeralStorage",
      "LastModified",
    ]);
  }

  if (scheduleDetails) {
    info("Found remote schedule uploaded:");
    console.table({ details: scheduleDetails }, [
      "Name",
      "ScheduleExpression",
      "StartDate",
      "EndDate",
      "State",
      "FlexibleTimeWindow",
      "LastModificationDate",
    ]);
  }

  if (!lambdaDetails && !scheduleDetails) {
    info("No remote resources found or deployed.");
  }
}
