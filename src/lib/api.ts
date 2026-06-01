import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import { load_config } from "./helpers/_utils.js";
import { DEFAULT_REGION, DEFAULT_TIMEZONE } from "./helpers/_defaults.js";
import type { SchedulerDate } from "./helpers/types.js";
import { toUnix } from "./helpers/_time.js";

async function pipeFetch(client: S3Client, bucket: string, key: string) {
  const latest = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  const payload = await latest
    .Body!.transformToString()
    .then((data) => JSON.parse(data));

  return payload;
}

export async function pipeFetchRange(
  range: [SchedulerDate, SchedulerDate],
  timezone: string = DEFAULT_TIMEZONE,
) {
  const { config } = (await load_config())!;
  const { name, region = DEFAULT_REGION } = config.deployment;
  const { bucket } = config.schema;

  const start = toUnix(range[0], timezone);
  const end = toUnix(range[1], timezone);

  const client = new S3Client({
    region,
    signer: { sign: async (request) => request },
  });

  try {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: `bucket/${name}`,
      }),
    );

    const entries = res.Contents!.filter((entry) => {
      const [timestamp] = entry.Key!.split(".");
      return timestamp && +timestamp >= start && +timestamp <= end;
    });

    const promises = entries.map((entry) =>
      pipeFetch(client, bucket, entry.Key!),
    );

    return Promise.all(promises);
  } catch (err: any) {
    throw Error(`pipeFetch Error: ${err}`);
  }
}

export async function pipeFetchLatest() {
  const { config } = (await load_config())!;
  const { name, region = DEFAULT_REGION } = config.deployment;
  const { bucket } = config.schema;
  const metadataKey = `pipe/${name}/metadata.json`;

  const client = new S3Client({
    region,
    signer: { sign: async (request) => request },
  });

  // TODO: add client/browser side caching for long-lived timestamp keys
  try {
    const metadata = await pipeFetch(client, bucket, metadataKey);
    const payload = await pipeFetch(client, bucket, metadata.latest);

    return payload;
  } catch (err: any) {
    throw Error(`pipeFetchLatest Error: ${err}`);
  }
}
