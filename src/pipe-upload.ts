import { fileURLToPath } from "node:url";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  promises,
  createWriteStream,
} from "node:fs";
import { basename, dirname, extname } from "node:path";
import { createHash } from "node:crypto";

import { program } from "commander";
import { select } from "@inquirer/prompts";

import archiver from "archiver";
import esbuild from "esbuild";

import { IAMClient } from "@aws-sdk/client-iam";
import {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
  GetFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";

import {
  is_js_file,
  is_dir,
  load_config,
  success,
  info,
  fatal_error,
  get_aws_role,
  get_aws_credentials,
} from "./_utils.js";
import type { Options } from "./types.js";
import {
  DEFAULT_REGION,
  RUNTIME,
  BUNDLE,
  DEFAULT_PIPE_ROLE,
} from "./_defaults.js";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

export async function bundleHandlers({
  path,
  handler,
  zip_dir,
}: {
  path: string;
  handler: string;
  zip_dir: string;
}) {
  let file = path;
  if (!path || path.length === 0) {
    const files = await Array.fromAsync(
      promises.glob(`**/${handler.split(".")[0]}.*`),
    );

    if (files.length === 0) {
      fatal_error(
        "No files found for provided handler, please provide a valid path or handler in the pipe configuration.",
      );
    } else if (files.length === 1) {
      file = files[0]!;
    } else {
      try {
        file = await select({
          message:
            "Multiple files found for provided handler, please select the file you want to deploy:",
          choices: files,
        });
      } catch (error: any) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          fatal_error(
            "Manually exited file selection prompt, exiting process.",
          );
        }
      }
    }
  }

  if (!existsSync(file)) {
    fatal_error("File path defined in pipe configuration does not exist.");
  }

  // TODO: Create a unique temporary filename that auto-cleans if zip destination path is not defined
  if (!zip_dir || zip_dir.length === 0) {
    fatal_error(
      "Zip directory destination path is not defined in pipe configuration",
    );
  }

  if (!existsSync(zip_dir)) {
    mkdirSync(zip_dir, { recursive: true });
  }

  let lambdaDir: string;

  if (extname(file) !== ".zip") {
    console.log(
      `Zipping provided file ${basename(file)} from file ${dirname(file)}`,
    );

    const outputFile = `${basename(file, extname(file))}.zip`;
    const zippables: string[] = [];

    if (is_js_file(file)) {
      console.log(
        "Javascript file detected. Bundling via esbuild to include dependencies...",
      );

      const bundleFile = `dist/${basename(file, extname(file))}.js`;

      await esbuild.build({
        entryPoints: [file],
        bundle: true,
        platform: "node",
        target: BUNDLE.DEFAULT_NODE_TARGET,
        outfile: bundleFile,
      });

      zippables.push(bundleFile);
    } else {
      zippables.push(file);
    }

    async function zipFiles(
      files: string[],
      outputFile: string,
    ): Promise<string> {
      return new Promise((resolve, reject) => {
        const outputDir = `${zip_dir}/${outputFile}`;

        const archive = archiver("zip", { zlib: { level: 9 } });
        const wStream = createWriteStream(outputDir);

        wStream.on("close", () => resolve(outputDir));
        wStream.on("error", reject);

        archive.on("error", reject);
        archive.pipe(wStream);

        files.forEach((path) => {
          if (is_dir(path)) {
            archive.directory(path, path, { date: new Date("2000-01-01Z") });
          } else {
            archive.file(path, {
              name: basename(path),
              date: new Date("2000-01-01Z"),
            });
          }
          info(`Added ${path}`);
        });

        archive.finalize();
      });
    }

    lambdaDir = await zipFiles(zippables, outputFile);
    success(`Created ${outputFile} successfully at ${lambdaDir!}`);
  } else {
    lambdaDir = file;
    console.log(`Skipping zip step for provided file at ${file}`);
  }

  return lambdaDir;
}

export async function uploadFunction(
  {
    name,
    role,
    region,
    handler,
    code,
  }: {
    name: string;
    role: string;
    region: string;
    handler: string;
    code: Buffer;
  },
  credentials: AwsCredentialIdentityProvider,
) {
  const lambdaClient = new LambdaClient({
    region: region,
    credentials,
  });

  async function waitUntilUpdated<T>(
    lambdaClientCommand: () => Promise<T>,
  ): Promise<T> {
    const res = await lambdaClientCommand();

    await waitUntilFunctionUpdatedV2(
      { client: lambdaClient, maxWaitTime: 60 },
      { FunctionName: name },
    ).catch((e: { state: "FAILURE" | "TIMEOUT" }) => {
      switch (e.state) {
        case "TIMEOUT":
          fatal_error(
            "Function update to AWS Lambda timed out, please try again.",
          );
        case "FAILURE":
          fatal_error("Function failed to update to AWS Lambda.");
      }
    });

    return res;
  }

  const command = new GetFunctionCommand({ FunctionName: name });
  const readHashCommand = new GetFunctionConfigurationCommand({
    FunctionName: name,
  });

  const exists = await lambdaClient.send(command).then(
    () => true,
    (error) => {
      if (error.name === "ResourceNotFoundException") {
        return false;
      }
      fatal_error(error);
    },
  );

  if (exists) {
    console.log(
      `Found existing deployed function, updating AWS Lambda ${name}`,
    );

    const params = {
      FunctionName: name,
      ZipFile: code,
    };

    const hash = createHash("sha256").update(code).digest("base64");
    const remoteHash = await lambdaClient
      .send(readHashCommand)
      .then(({ CodeSha256 }) => CodeSha256);

    if (hash !== remoteHash) {
      const updateCode = new UpdateFunctionCodeCommand(params);
      const res = await waitUntilUpdated(() => lambdaClient.send(updateCode));
      success(`Function updated successfully: ${res.FunctionName}`);
    } else {
      console.log(
        `No detected code changes for function ${name}. Skipping code update step.`,
      );
    }

    console.log(`Updating configs for AWS Lambda ${name}`);

    const configs = {
      FunctionName: name,
      Runtime: RUNTIME.DEFAULT_NODEJS,
      Handler: handler,
      Role: role,
    };

    const updateConfig = new UpdateFunctionConfigurationCommand(configs);
    const res = await waitUntilUpdated(() => lambdaClient.send(updateConfig));

    success(`Configuration updated successfully: ${res.FunctionName}`);
    return res;
  } else {
    console.log(`Deploying AWS Lambda function ${name} at ${region}`);

    const params = {
      FunctionName: name,
      Runtime: RUNTIME.DEFAULT_NODEJS,
      Handler: handler,
      Role: role,
      Code: {
        ZipFile: code,
      },
    };

    const command = new CreateFunctionCommand(params);
    const res = await lambdaClient.send(command);

    success(`Function created successfully:", ${res.FunctionName}`);
    return res;
  }
}

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const {
    name,
    region = DEFAULT_REGION,
    handler,
    path,
    zip_dir,
    profile,
    pipe_role,
  } = config.deployment;

  const credentials = await get_aws_credentials(profile);

  const roleClient = new IAMClient({
    region: region,
    credentials,
  });

  try {
    const lambdaDir = await bundleHandlers({ path, handler, zip_dir });
    const code = readFileSync(lambdaDir);

    const pipeRole = await get_aws_role(
      roleClient,
      pipe_role,
      DEFAULT_PIPE_ROLE,
    );

    await uploadFunction(
      { name, role: pipeRole, region, handler, code },
      credentials,
    );
  } catch (error: any) {
    fatal_error(error);
  }
};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .parse();

  main(program.args, program.opts());
}
