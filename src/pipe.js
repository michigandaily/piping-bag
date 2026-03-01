import { program } from "commander";

program
  .version("0.0.1")
  .name("pipe")
  .description("Data collection scripts")
  .command("deploy", "Deploys a custom script to AWS Lambda");

program.parse(process.argv);
