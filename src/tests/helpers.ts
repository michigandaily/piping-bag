import path from "node:path";
import { mock } from "node:test";

import {
  CreateFunctionCommand,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import {
  CreateScheduleCommand,
  GetScheduleCommand,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const fixtures = (subpath: string) =>
  `${path.resolve(import.meta.dirname, "fixtures")}/${subpath}`;

export async function unpack() {}

interface MockLambdaOptions {
  GetFunction?: object;
  GetFunctionConfiguration?: object;
  CreateFunction?: object;
  UpdateFunctionCode?: object;
  UpdateFunctionConfiguration?: object;
}

interface MockScheduleOptions {
  GetSchedule?: object;
  CreateSchedule?: object;
  UpdateSchedule?: object;
}

interface MockS3Options {}

export function mockLambdaClient(opts: MockLambdaOptions) {
  const responses: MockLambdaOptions = {
    GetFunction: {
      CommandName: "GetFunctionCommand",
      ...opts.GetFunction,
    },
    GetFunctionConfiguration: {
      CommandName: "GetFunctionConfigurationCommand",
      ...opts.GetFunctionConfiguration,
    },
    CreateFunction: {
      CommandName: "CreateFunction",
      ...opts.CreateFunction,
    },
    UpdateFunctionCode: {
      CommandName: "UpdateFunctionCodeCommand",
      ...opts.UpdateFunctionCode,
    },
    UpdateFunctionConfiguration: {
      CommandName: "UpdateFunctionConfigurationCommand",
      ...opts.UpdateFunctionConfiguration,
    },
  };

  const send = mock.fn(async (command) => {
    const { FunctionName } = command.input;
    if (command instanceof GetFunctionCommand) return responses.GetFunction;
    if (command instanceof GetFunctionConfigurationCommand)
      return responses.GetFunctionConfiguration;
    if (command instanceof CreateFunctionCommand)
      return responses.CreateFunction;
    if (command instanceof UpdateFunctionCodeCommand)
      return responses.UpdateFunctionCode;
    if (command instanceof UpdateFunctionConfigurationCommand)
      return responses.UpdateFunctionConfiguration;
  });

  return send as unknown as LambdaClient;
}

export function mockSchedulerClient(opts: MockScheduleOptions) {
  const responses: MockScheduleOptions = {
    ...opts,
  };

  const send = mock.fn(async (command) => {
    if (command instanceof GetScheduleCommand) return;
    if (command instanceof CreateScheduleCommand) return;
    if (command instanceof UpdateScheduleCommand) return;
  });

  return send;
}

export function mockS3Client(opts: MockS3Options) {
  const responses: MockS3Options = {
    ...opts,
  };

  const send = mock.fn(async (command) => {
    if (command instanceof ListObjectsV2Command) return;
    if (command instanceof GetObjectCommand) return;
  });

  return send;
}
