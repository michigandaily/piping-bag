#!/usr/bin/env node
import { program } from "commander";

program
  .version("0.0.1")
  .name("pipe")
  .description("Data collection scripts")
  .command("deploy", "Deploys a custom script to AWS Lambda")
  .command("schedule", "Schedules a deployed AWS Lambda function to run at a specific rate")

program.parse(process.argv);
