#!/usr/bin/env node
import { program } from "commander";

program
  .version("0.0.1")
  .name("pipe")
  .description("Data collection scripts")
  .command("deploy", "Deploys and schedules a custom script to AWS Lambda")
  .command("upload", "Uploads a zipped script to AWS Lambda")
  .command(
    "schedule",
    "Schedules a deployed AWS Lambda function to run at a specific rate",
  )
  .command(
    "list",
    "Lists all instantiated lambdas and schedules made by piping-bag",
  )
  .command(
    "destroy",
    "Destroys all global AWS resources related to the piping-bag configuration",
  );

program.parse(process.argv);
