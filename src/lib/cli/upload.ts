import { existsSync, mkdirSync, promises, createWriteStream } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { createHash } from "node:crypto";

import { select } from "@inquirer/prompts";

import archiver from "archiver";
import esbuild from "esbuild";

import {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";

import {
  is_js_file,
  is_dir,
  success,
  info,
  fatal_error,
  waitUntilUpdated,
} from "../helpers/_utils.js";
import { RUNTIME, BUNDLE } from "../helpers/_defaults.js";
import type { Config } from "../helpers/types.js";

// TODO: refactor zip functionality to use fflate instead of archiver
// consider fflate stability before migrating libraries
export async function zipFiles({
  files,
  buffers,
  outputDir,
}: {
  files: string[];
  buffers: { name: string; body: string }[];
  outputDir: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
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

    buffers.forEach(({ name, body }: { name: string; body: string }) => {
      archive.append(body, { name });
    });

    archive.finalize();
  });
}

export async function bundleHandlers(
  {
    path,
    handler,
    zip_dir,
  }: {
    path: string;
    handler: string;
    zip_dir: string;
  },
  config: Config,
) {
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
          theme: { keybindings: ["vim"] },
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
        external: ["@aws-sdk/*"],
      });

      zippables.push(bundleFile);
    } else {
      zippables.push(file);
    }

    lambdaDir = await zipFiles({
      files: zippables,
      buffers: [{ name: "pipe.config.json", body: JSON.stringify(config) }],
      outputDir: `${zip_dir}/${outputFile}`,
    });
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
    mem_size,
    timeout,
    code,
  }: {
    name: string;
    role: string;
    region: string;
    handler: string;
    mem_size: number;
    timeout: number;
    code: Buffer;
  },
  lambdaClient: LambdaClient,
) {
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

  let resCode;
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
      resCode = await waitUntilUpdated(name, lambdaClient, () =>
        lambdaClient.send(updateCode),
      );
      success(`Function updated successfully: ${resCode.FunctionName}`);
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
      MemorySize: mem_size,
      Timeout: timeout,
      Environment: {
        Variables: {
          STAGE: "production",
        },
      },
    };

    const updateConfig = new UpdateFunctionConfigurationCommand(configs);
    const resConfig = await waitUntilUpdated(name, lambdaClient, () =>
      lambdaClient.send(updateConfig),
    );

    success(`Configuration updated successfully: ${resConfig.FunctionName}`);
    return [resCode, resConfig];
  } else {
    console.log(`Deploying AWS Lambda function ${name} at ${region}`);

    const params = {
      FunctionName: name,
      Runtime: RUNTIME.DEFAULT_NODEJS,
      Handler: handler,
      Role: role,
      MemorySize: mem_size,
      Timeout: timeout,
      Code: {
        ZipFile: code,
      },
      Environment: {
        Variables: {
          STAGE: "production",
        },
      },
    };

    const command = new CreateFunctionCommand(params);
    const res = await lambdaClient.send(command);

    success(`Function created successfully: ${res.FunctionName}`);
    return [undefined, res];
  }
}
