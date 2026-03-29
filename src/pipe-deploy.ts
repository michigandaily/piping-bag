import { fileURLToPath } from "node:url";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  promises,
  createWriteStream,
} from "node:fs";
import { basename, dirname, extname } from "node:path";

import { program } from "commander";
import { select } from "@inquirer/prompts";

import archiver from "archiver";
import esbuild from "esbuild";

import {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";

import {
  fatal_error,
  is_js_file,
  is_dir,
  load_config,
  success,
} from "./_utils.js";
import type { Options } from "./types.js";
import { PIPE_ROLE, DEFAULT_REGION, RUNTIME, BUNDLE } from "./_defaults.js";

const self = fileURLToPath(import.meta.url);

const main = async ([], opts: Options) => {
  const { config } = (await load_config(opts.config))!;

  const shouldZip = opts.zip;
  const manualPrompt = opts.yes === undefined;

  const { name, region, handler, path, zip_dir, profile } = config.deployment;

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
        fatal_error(error);
      }
    }
  }

  if (!existsSync(file)) {
    fatal_error("File path defined in pipe configuration does not exist.");
  }

  // TODO: Create a unique temporary filename that auto-cleans if zip destination path is not defined
  if ((!zip_dir || zip_dir.length === 0) && shouldZip) {
    fatal_error(
      "Zip directory destination path is not defined in pipe configuration",
    );
  }

  if (!existsSync(zip_dir)) {
    mkdirSync(zip_dir, { recursive: true });
  }

  let lambdaDir;

  // TODO: compare hash of any previous zip files with current (node:crypto)
  // If the hash is the same, skip the update code step of AWS lambda
  if (shouldZip) {
    let outputFile;

    try {
      outputFile = `${basename(file, extname(file))}.zip`;
      console.log(
        `Zipping provided file ${basename(file)} from file ${dirname(file)}`,
      );

      const zippables = [];

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

      lambdaDir = `${zip_dir}/${outputFile}`;

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(createWriteStream(lambdaDir));

      zippables.forEach((path) => {
        if (is_dir(path)) {
          archive.directory(path, path);
        } else {
          console.log(path)
          console.log(basename(path))
          archive.file(path, { name: basename(path) });
        }
        success(`Added ${path}`);
      });

      await archive.finalize();
    } catch (error: any) {
      fatal_error(error);
    }

    success(`Created ${outputFile} successfully at ${lambdaDir}`);
  } else {
    lambdaDir = file;
    console.log(`Skipping zip step for provided file at ${file}`);
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
      };

      const updateConfig = new UpdateFunctionConfigurationCommand(configs);
      const updateCode = new UpdateFunctionCodeCommand(params);

      const _ = await lambdaClient.send(updateConfig);

      await waitUntilFunctionUpdatedV2(
        { client: lambdaClient, maxWaitTime: 60 },
        { FunctionName: name },
      ).catch((e: { state: "FAILURE" | "TIMEOUT" }) => {
        switch (e.state) {
          case "TIMEOUT":
            fatal_error("Function update to AWS Lambda timed out, please try again.");
          case "FAILURE":
            fatal_error("Function failed to update to AWS Lambda.");
        }
      });

      const res = await lambdaClient.send(updateCode);

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
