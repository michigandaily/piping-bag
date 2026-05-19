# piping-bag

> An standardized elections data pipeline for The Michigan Daily

A standardized way to set up data scrapers and pull/refine data for The Michigan Daily. This can be seen as a sibling script of [michigandaily/sink](https://github.com/michigandaily/sink).

> [!WARNING]  
> This library is a work in progress

## Installation

Run `pnpm install -D michigandaily/piping-bag` to get the current state of `piping-bag`. The project is being developed, so there are no official releases so far.

## Deployment

Create a configuration file (e.g. `pipe.config.js`). The file should have a `deployment` property that outlines the necessary parameters needed to upload to AWS Lambda.

```javascript
// pipe.config.js
import { defineConfig } from "piping-bag";

export default defineConfig({
  deployment: {
    name: "scraper",
    handler: "scraper.handler",
    region: "us-east-2", // optional
    path: "./src/scraper.js",
    zip_dir: "./tmp",
    mem_size: 512, // 512 GB, optional
    timeout: 10, // 10 seconds, optional
    profile: "pipe",
    pipe_role: "pipe-lambda",
  },
  schedule: {
    start: defineSchedulerDate({
      hour: 9, // 9 AM
      day: 1, // 1st
      month: 1, // January
      year: 2027,
    }),
    end: defineSchedulerDate({
      hour: 21, // 9 PM
      day: 2, // 2nd
      month: 1, // January
      year: 2027,
    }),
    rate: "rate(5 minutes)",
    // rate: 'cron(0 12 * * ? *)' // you can also use cron expressions
    timezone: "America/Detroit", // default timezone is America/Detroit if not specified
    scheduler_role: "pipe-eventbridge",
  },
  schema: {
    bucket: "stash.michigandaily.com",
  },
});
```

## IAM Setup

The `profile` property defines the name of the AWS credentials profile that you will have to populate in `~/.aws/credentials`[^note]. For daily staffers, the `profile` is `pipe` by default. Make sure to use a file with all the proper AWS Lambda and S3 permissions. See `example.pipe-profile.json` for all required permissions.

```sh
# ~/.aws/credentials
[pipe]
aws_access_key_id=<SECRET_KEY>
aws_secret_access_key=<SECRET_KEY>
```

The `pipe_role` and `scheduler_role` properties define the name of the AWS role names that you will have to define within your AWS IAM dashboard. Both `pipe_role` and `scheduler_role` require at minimum basic lambda write permissions.

## Development

To start developing, clone the repo. Run `pnpm install` to install all dependencies. `piping-bag` is written in Typescript, so all code needs to be transpiled to Javascript before it can be used and tested as a package. To watch for changes and automatically transpile the code as you develop, run `pnpm dev`.

For local development, you can symlink to your local version of `pipng-bag` with `pnpm link`. Now, whenever you want to test your local `piping-bag`, you can use a test folder with a valid `package.json`. Use `pnpm link piping-bag` to link your local version as a dependency of your test folder.

[^note]: For now, ask @yum25 for the pipe credentials. It should be added to 1password later.

## Milestones

- M1 - Naive upload script (.zip) to AWS Lambda and AWS EventBridge ✅️
- M2 - Naive helper function to pipe scraper data into an AWS S3 bucket
- M3 - Configurable upload script using config file ✅️
  - Should allow configurable lambda start time and end time ✅️
  - At this point, is already usable/useful for basic elections scraping
  - Consider adding support for uploading docker images 🟠
- M4 - Configurable helper function to pipe scraper data into specific AWS S3 bucket
  - The data configuration/schema for AWS S3 should be set at this point 🟠
    - consider JSON validation before deployment
  - consider adding support for uploading custom layers provided by pipe - multilanguage solution
    for AWS S3 upload helper functions
- M5 - Helper function to collect all existing data from one scraper into a JSON response (Similar to an API service)
- M6 - Developer testing and verification
  - Important to assess any footguns, embed preventative measures in the code to prevent developers from overwriting important S3 buckets or lambdas
  - Prevent devs from running lambda indefinitely ✅️ (must define end date)
  - Assess S3 storage efficiency
- M7 - Add (slack?) notification system for failures
  - Lambda running too long, lambda start times/end times
  - Lambda code failures
- M8 - Assess future improvements
  - Unit + integration testing? 🟠
    - Consider using local docker image for testing as well
  - Fetch/ingestion scripts to pull data from a variety of sources (google docs, sheets, pdfs, etc)?
  - Formalized API for pulling elections data (data in a standardized, schema format)?
