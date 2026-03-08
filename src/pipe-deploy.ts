import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import AdmZip from "adm-zip";

import { program } from "commander";

import {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";

import { fatal_error, is_dir, load_config, success } from "./_utils.js";
import type { Options } from "./types.js";
import { PIPE_ROLE, DEFAULT_REGION, RUNTIME } from "./_defaults.js";

const self = fileURLToPath(import.meta.url);

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const shouldZip = opts.zip;
  const manualPrompt = opts.yes === undefined;

  const { name, region, handler, path, zip_dir, profile } = config.deployment;

  if (!path || path.length === 0) {
    fatal_error("File path is not defined in pipe configuration");
  }
  // TODO: Create a unique temporary filename that auto-cleans if zip destination path is not defined
  if ((!zip_dir || zip_dir.length === 0) && shouldZip)
    [
      fatal_error(
        "Zip directory destination path is not defined in pipe configuration",
      ),
    ];

  if (!existsSync(path)) {
    fatal_error("File path defined in pipe configuration does not exist.");
  }

  let lambdaDir;

  if (!existsSync(zip_dir)) {
    mkdirSync(zip_dir, { recursive: true });
  }

  if (shouldZip) {
    let outputFile;

    try {
      outputFile = `${basename(path, extname(path))}.zip`;
      console.log(
        `Zipping provided file ${basename(path)} from path ${dirname(path)}`,
      );

      lambdaDir = `${zip_dir}/${outputFile}`;

      const zip = new AdmZip();

      if (is_dir(path)) {
        zip.addLocalFolder(path);
      } else {
        zip.addLocalFile(path);
      }

      zip.writeZip(lambdaDir);
    } catch (error: any) {
      fatal_error(error);
    }

    success(`Created ${outputFile} successfully at ${lambdaDir}`);
  } else {
    lambdaDir = path;
    console.log(`Skipping zip step for provided file at ${path}`);
  }

  const lambdaClient = new LambdaClient({
    region: region ?? DEFAULT_REGION,
    profile,
  });
  const command = new GetFunctionCommand({ FunctionName: name });

  const exists = await lambdaClient.send(command).then(
    () => true,
    (err) => {
      if (err.name === "ResourceNotFoundException") {
        return false;
      }
      fatal_error(err);
    },
  );

  try {
    const code = readFileSync(lambdaDir!);

    if (exists) {
      console.log(
        `Found existing deployed function, updating AWS Lambda ${name}`,
      );

      const configs = {
        FunctionName: name,
        Runtime: RUNTIME.DEFAULT_NODEJS,
        Handler: handler,
        Role: PIPE_ROLE,
      };

      const params = {
        FunctionName: name,
        ZipFile: code,
        DryRun: true,
      };

      const updateConfig = new UpdateFunctionConfigurationCommand(configs);
      const updateCode = new UpdateFunctionCodeCommand(params);

      const [_, res] = await Promise.all([
        lambdaClient.send(updateConfig),
        lambdaClient.send(updateCode),
      ])

      success(`Function updated successfully: ${res.FunctionName}`);
    } else {
      console.log(
        `Deploying AWS Lambda function ${name} at ${region ?? DEFAULT_REGION}`,
      );

      const params = {
        FunctionName: name,
        Runtime: RUNTIME.DEFAULT_NODEJS,
        Handler: handler,
        Role: PIPE_ROLE,
        Code: {
          ZipFile: code,
        },
      };

      const command = new CreateFunctionCommand(params);
      const res = await lambdaClient.send(command);

      success(`Function created successfully:", ${res.FunctionName}`);
    }
  } catch (err: any) {
    fatal_error(err);
  }
};

if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .option(
      "--nz, --no-zip",
      "does not zip the file provided by path, making path the zip directory",
    )
    .option("-y, --yes", "answer yes to prompts")
    .parse();

  main(program.args, program.opts());
}
