import { fileURLToPath } from "node:url";
import { program } from "commander";

const self = fileURLToPath(import.meta.url);

const main = async (opts) => {
    console.log("Hello World")
}

if (process.argv[1] === self) {
  program
    .version("0.0.1")
    .option("-c, --config <path>", "path to config file")
    .option("-y, --yes", "answer yes to prompts")
    .parse();

  main(program.args, program.opts());
}