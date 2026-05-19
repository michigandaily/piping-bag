export const DEFAULT_REGION = "us-east-2";
export const DEFAULT_TIMEZONE = "America/Detroit";
export const DEFAULT_PIPE_ROLE = "pipe-lambda";
export const DEFAULT_SCHEDULER_ROLE = "pipe-eventbridge";

export enum RUNTIME {
  DEFAULT_NODEJS = "nodejs24.x",
  DEFAULT_PYTHON = "python3.14",
}
export enum BUNDLE {
  DEFAULT_NODE_TARGET = "node24",
}

export enum MEMSIZE {
  DEFAULT = 512,
  MINIMUM = 128,
  SMALL = 256,
  MEDIUM = 512,
  LARGE = 1024,
  XLARGE = 1769,
  XXLARGE = 3008,
  MAXIMUM = 10240,
}

export enum TIMEOUT {
  DEFAULT = 10,
  MINIMUM = 3,
  SMALL = 10,
  MEDIUM = 30,
  LARGE = 120,
  XLARGE = 300,
  MAXIMUM = 900,
}
