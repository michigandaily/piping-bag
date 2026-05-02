export type Config = {
  deployment: {
    name: string;
    region: string;
    handler: string;
    path: string;
    zip_dir: string;
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
};

export type Options = {
  config: string;
  zip: boolean;
  yes: boolean;
};

export type SchedulerDate = {
  hour: number;
  day: number;
  month?: number;
  year?: number;
};
