import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import AdmZip from "adm-zip";

import { program } from "commander";

import { LambdaClient } from "@aws-sdk/client-lambda";
import { fromIni, fromEnv } from "@aws-sdk/credential-providers";

import { fatal_error, is_dir, load_config, success } from "./_utils.js";

const self = fileURLToPath(import.meta.url);

const main = async ([], opts) => {
  const { config } = await load_config(opts.config);

  const shouldZip = opts.zip
  const manualPrompt = opts.yes === undefined;

  const { path, zip_dir, profile } = config.deployment;

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

  let credentials;

  if (profile) {
    credentials = fromIni({ profile });
  } else {
    console.log(
      "no AWS credentials profile was specified. falling back to environment variables.",
    );
    await import("dotenv/config");

    if (
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY
    ) {
      credentials = fromEnv();
    } else {
      console.error(
        "no AWS credentials were specified in the environment variables. exiting.",
      );
      exit(1);
    }
  }

  let lambdaDir;

  if (!existsSync(zip_dir)) {
    mkdirSync(zip_dir, { recursive: true });
  }

  if (shouldZip) {
    const outputFile = `${path.split("/").at(-1)}.zip`;
    console.log(`Zipping provided file to ${outputFile} from path ${path}`);

    lambdaDir = `${zip_dir}/${outputFile}`;

    try {
      const zip = new AdmZip();

      if (is_dir(path)) {
        zip.addLocalFolder(path);
      } else {
        zip.addLocalFile(path);
      }

      zip.writeZip(lambdaDir);
    } catch (error) {
      fatal_error(error);
    }

    success(`Created ${outputFile} successfully at ${lambdaDir}`);
  } else {
    lambdaDir = path;
    console.log(`Skipping zip step for provided file at ${path}`);
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
