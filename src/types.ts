export type Config = {
  deployment: {
    name: string;
    region: string;
    handler: string;
    path: string;
    zip_dir: string;
    profile: string;
  };
  schedule: {
    start: Date;
    end: Date;
    rate: string;
  }
};

export type Options = {
  config: string;
  zip: boolean;
  yes: boolean;
};
