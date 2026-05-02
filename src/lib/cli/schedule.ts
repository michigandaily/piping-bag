import {
  CreateScheduleCommand,
  GetScheduleCommand,
  SchedulerClient,
  UpdateScheduleCommand,
  type CreateScheduleCommandInput,
  type UpdateScheduleCommandInput,
} from "@aws-sdk/client-scheduler";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import { success, info, fatal_error } from "../helpers/_utils.js";

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
    enable,
  }: {
    arn: string;
    name: string;
    role: string;
    region: string;
    start: Date;
    end: Date;
    rate: string;
    enable: boolean;
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
    State: enable ? "ENABLED" : "DISABLED",
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
  if (enable) {
    info(
      `${res?.ScheduleArn} has been enabled to run live on the scheduled time interval`,
    );
  } else {
    info(
      `${res?.ScheduleArn} has been disabled, run [pnpm pipe schedule enable] to update scheduler to run live at the scheduled time`,
    );
  }

  return res;
}
