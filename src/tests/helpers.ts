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

interface MockError {
  Name: string;
  Message: string;
}

type MockExtendedOptions = object & { CommandName?: string; Error?: MockError };

interface MockLambdaOptions {
  GetFunction?: MockExtendedOptions;
  GetFunctionConfiguration?: MockExtendedOptions;
  CreateFunction?: MockExtendedOptions;
  UpdateFunctionCode?: MockExtendedOptions;
  UpdateFunctionConfiguration?: MockExtendedOptions;
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
      CommandName: "CreateFunctionCommand",
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
    const { FunctionName, Role, Handler, MemorySize, Timeout } = command.input;
    if (command instanceof GetFunctionCommand) {
      if (responses.GetFunction?.Error) {
        throw Object.assign(new Error(responses.GetFunction.Error.Message), {
          name: responses.GetFunction.Error.Name,
        });
      }

      return responses.GetFunction;
    }
    if (command instanceof GetFunctionConfigurationCommand)
      return responses.GetFunctionConfiguration;
    if (command instanceof CreateFunctionCommand)
      return {
        FunctionName,
        Role,
        Handler,
        MemorySize,
        Timeout,
        ...responses.CreateFunction,
      };
    if (command instanceof UpdateFunctionCodeCommand)
      return {
        FunctionName,
        Role,
        Handler,
        MemorySize,
        Timeout,
        ...responses.UpdateFunctionCode,
      };
    if (command instanceof UpdateFunctionConfigurationCommand)
      return {
        FunctionName,
        Role,
        Handler,
        MemorySize,
        Timeout,
        ...responses.UpdateFunctionConfiguration,
      };
  });

  return { send } as unknown as LambdaClient;
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

  return { send };
}

export function mockS3Client(opts: MockS3Options) {
  const responses: MockS3Options = {
    ...opts,
  };

  const send = mock.fn(async (command) => {
    if (command instanceof ListObjectsV2Command) return;
    if (command instanceof GetObjectCommand) return;
  });

  return { send };
}
