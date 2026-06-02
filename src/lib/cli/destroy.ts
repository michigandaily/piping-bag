import { createInterface } from "node:readline";

import {
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import {
  DeleteScheduleCommand,
  GetScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import { info, warn } from "../helpers/_utils.js";

function prompt() {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((res, rej) => {
    prompt.question(
      "Are you sure you want to delete the remote resource? [Y/n]",
      (confirm) => {
        prompt.close();
        if (confirm === "Y") {
          res(true);
        } else {
          rej(false);
        }
      },
    );
  });
}

export async function destroyResources(
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

    if (await prompt()) {
      await lambdaClient.send(
        new DeleteFunctionCommand({ FunctionName: name }),
      );
    } else {
      warn("Skipping lambda deletion, continuing...");
    }
  }

  const schedulerClient = new SchedulerClient({ region, credentials });
  const schedulerName = `${name}-schedule`;

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

    if (await prompt()) {
      await schedulerClient.send(
        new DeleteScheduleCommand({ Name: schedulerName }),
      );
      info("Successfully deleted scheduler");
    } else {
      warn("Skipping scheduler deletion, continuing...");
    }
  }

  if (!lambdaDetails && !scheduleDetails) {
    info("No remote resources found or deployed.");
  }
}
