export type Config = {
  deployment: {
    name: string;
    region: string;
    handler: string;
    path: string;
    zip_dir: string;
    mem_size: number;
    timeout: number;
    profile: string;
    pipe_role: string;
  };
  schedule: {
    start: SchedulerDate;
    end: SchedulerDate;
    rate: string;
    scheduler_role: string;
    timezone: string;
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
