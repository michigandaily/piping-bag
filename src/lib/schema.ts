import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Temporal } from "@js-temporal/polyfill";

import { load_config } from "./helpers/_utils.js";
import { DEFAULT_REGION } from "./helpers/_defaults.js";

export async function pipe(payload: string, format: string = ".json") {
  // NoOp and log on dev environments
  if (process.env.STAGE !== "production") {
    console.log(payload);
    return;
  }

  // Production S3 Upload
  const { config } = (await load_config())!;

  const { name, region = DEFAULT_REGION } = config.deployment;
  const { bucket } = config.schema;
  const key = `pipe/${name}/${Temporal.Now.instant().epochMilliseconds}${format}`;

  const client = new S3Client({ region });
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: payload,
      }),
    );
  } catch (err: any) {
    throw Error(
      `pipe error: Failed to store latest scraper results in ${bucket}/${key}, see message: \n 
                    \t${err}`,
    );
  }

  try {
    const metadata = {
      latest: `${key}/${format}`,
      bucket,
      region,
    };
    const metadataKey = `pipe/${name}/metadata.json`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
      }),
    );
  } catch (err: any) {
    throw Error(
      `pipe error: Failed to update schema metadata in ${bucket}/${key}, see message: \n 
                    \t${err}`,
    );
  }
}
