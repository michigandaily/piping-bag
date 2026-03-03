export type Config = {
  deployment: {
    name: string;
    desc: string;
    handler: string;
    path: string;
    zip_dir: string;
    profile: string;
  };
};

export type Options = {
  config: string;
  zip: boolean;
  yes: boolean;
};
