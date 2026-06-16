export type Config = {
  name: string;
  region: string;
  profile: string;
  deployment: {
    handler: string;
    path: string;
    zip_dir: string;
    mem_size: number;
    timeout: number;
    pipe_role: string;
  };
  schedule: {
    start: SchedulerDate;
    end: SchedulerDate;
    rate: string;
    timezone: string;
    scheduler_role: string;
  };
  schema: {
    bucket: string;
  };
};

export type Options = {
  config: string;
  yes: boolean;
};

export type SchedulerDate = {
  hour: number;
  day: number;
  month?: number;
  year?: number;
};

export type PipeData = {
  timestamp: number;
  data: any;
};

export type PipeMetadata = {
  latest: string;
};

export enum PollingType {
  Latest = "update",
  Timeline = "change",
}
