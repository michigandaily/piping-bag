# piping-bag

> An standardized elections data pipeline for The Michigan Daily
> [!WARNING]  
> This library is a work in progress

Milestones:

- M1 - Naive upload script (.zip) to AWS Lambda and AWS EventBridge
- M2 - Naive helper function to pipe scraper data into an AWS S3 bucket
- M3 - Configurable upload script using config file
  - Should allow configurable lambda start time and end time
  - At this point, is already usable/useful for basic elections scraping
- M4 - Configurable helper function to pipe scraper data into specific AWS S3 bucket
  - The data configuration/schema for AWS S3 should be set at this point
  - While developed separately, its best if config for helper and upload script are the same
- M5 - Helper function to collect all existing data from one scraper into a JSON response (Similar to an API service)
- M6 - Developer testing and verification
  - Important to assess any footguns, embed preventative measures in the code to prevent developers from overwriting important S3 buckets or lambdas
  - Prevent devs from running lambda indefinitely
  - Assess S3 storage efficiency
- M7 - Add (slack?) notification system for failures
  - Lambda running too long, lambda start times/end times
  - Lambda code failures
- M8 - Assess future improvements
  - Unit + integration testing?
  - Fetch/ingestion scripts to pull data from a variety of sources (google docs, sheets, pdfs, etc)?
  - Formalized API for pulling elections data (data in a standardized, schema format)?
