import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync
} from "node:fs";
import type { PathOrFileDescriptor, PathLike } from "node:fs";

import { dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { styleText } from "node:util";

import { findUp } from "find-up";
import "dotenv/config";

import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import type { Config } from "./types.js";

export const get_aws_role = async (client: IAMClient, role_name: string, default_name: string) => (
  await client.send(new GetRoleCommand({
    RoleName: role_name ?? default_name
  })).then(({ Role }) => {
    if (Role?.Arn) {
      return Role.Arn;
    }
    throw Error("piping-bag error: Invalid pipeRoleArn found.")
  }).catch((error: any) => {
    if (process.env[role_name] && process.env[role_name].length > 0) {
      warn(`Fetching ${role_name} failed. Falling back to environment variables...`)
      return process.env[role_name];
    }
    throw Error(error);
  })
)

export const get_aws_credentials = async (profile: string): Promise<AwsCredentialIdentityProvider> => {
  if (profile) {
    return fromIni({ profile });
  } else {
    warn(
      "no AWS credentials profile was specified. falling back to environment variables."
    );

    if (
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY
    ) {
      return fromEnv();
    } else {
      throw Error("no AWS credentials were specified in the environment variables. exiting.");
    }
  }
}

export const is_js_file = (filename: string) => {
  return extname(filename) === ".js";
};

export const read_json_config = (path: PathOrFileDescriptor): { config: Config } => {
  return { config: JSON.parse(readFileSync(path).toString()) };
};

export const read_js_config = async (path: string): Promise<{ config: Config }> => {
  const config = (await import(pathToFileURL(path).toString())).default;
  return { config };
};

export const has_filled_props = (o: Object) => Object.values(o).every((v) => v.length);

export const is_dir = (dir: PathLike) => statSync(dir).isDirectory();

// Search directory for configuration file
export const load_config = async (configFile: string | null = null) => {
  const defaults = [
    "pipe.config.js",
    "pipe.config.mjs",
    "pipe.config.cjs",
    "pipe.config.json",
  ];
  const searchFiles = configFile ? [configFile, ...defaults] : defaults;
  for (const searchFile of searchFiles) {
    const path = await findUp(searchFile);
    if (typeof path === "undefined") continue;
    if (is_js_file(path)) {
      return await read_js_config(path);
    }
    return read_json_config(path);
  }
  fatal_error("Could not load config file");
};

export const write_file = (output: string, content: string) => {
  const dir = dirname(output);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(output, content);
};

export const fatal_error = (message: string) => {
  console.error(`${styleText("red", "Fatal Error: ")} ${message}`);
  process.exit(1);
};

export const success = (message: string) => {
  console.log(styleText('green', message));
};

export const info = (message: string) => {
  console.log(styleText('cyan', message));
};

export const warn = (message: string) => {
  console.warn(styleText("yellow", message));
}
