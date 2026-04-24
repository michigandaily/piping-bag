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
    start: Date;
    end: Date;
    rate: string;
    scheduler_role: string;
  };
};

export type Options = {
  config: string;
  zip: boolean;
  yes: boolean;
};
