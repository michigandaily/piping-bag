import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import { DEFAULT_REGION, DEFAULT_TIMEZONE } from "./helpers/_defaults.js";
import type { SchedulerDate } from "./helpers/types.js";
import { currentUnix, toUnix } from "./helpers/_time.js";
import EventEmitter from "node:events";

export class PipeClient {
  client: S3Client;
  name: string;
  bucket: string;
  useCache: boolean;
  data: Record<number, any>;

  poller!: ReturnType<typeof setInterval>;
  emitter!: EventEmitter;

  constructor({
    name,
    region = DEFAULT_REGION,
    bucket,
    useCache = true,
  }: {
    name: string;
    region: string;
    bucket: string;
    useCache: boolean;
  }) {
    // TODO: prepopulate data with cached browser/clientside data
    // if useCache is true
    this.data = {};
    this.name = name;
    this.bucket = bucket;
    this.useCache = useCache;

    this.client = new S3Client({
      region,
      signer: { sign: async (request) => request },
    });
  }

  getData(id?: number) {
    if (id) {
      return this.data[id];
    }
    return this.data;
  }

  clearData() {
    this.data = {};
  }

  startPoll(interval: number = 50000) {
    this.emitter = new EventEmitter();

    // TODO: set data in browser/clientside cache and pull
    // from there if it exists and useCache is true
    this.poller = setInterval(async () => {
      const entries = await PipeClient.fetchRange(
        this.client,
        this.name,
        this.bucket,
        [currentUnix() - interval, currentUnix()],
      );

      this.data = {
        ...this.data,
        ...entries,
      };

      this.emitter.emit("update", this.getData());
    }, interval);

    return this.emitter;
  }

  endPoll() {
    // TODO: clear browser/clientside cache
    clearInterval(this.poller);
  }

  listen(id: string, callback: (event: any[]) => {}) {
    this.startPoll().on(id, callback);
  }

  static async fetch(client: S3Client, bucket: string, key: string) {
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

  // FIXME: return the relevant timestamp in addition to the
  // data instead of a naive unordered array. This could be
  // potentially implemented in the schema itself.
  static async fetchRange(
    client: S3Client,
    name: string,
    bucket: string,
    range: [SchedulerDate | number, SchedulerDate | number],
    timezone: string = DEFAULT_TIMEZONE,
  ) {
    const start =
      typeof range[0] === "number" ? range[0] : toUnix(range[0], timezone);
    const end =
      typeof range[1] === "number" ? range[1] : toUnix(range[1], timezone);

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
        PipeClient.fetch(client, bucket, entry.Key!),
      );

      return Promise.all(promises);
    } catch (err: any) {
      throw Error(`pipeFetch Error: ${err}`);
    }
  }

  static async fetchLatest(client: S3Client, name: string, bucket: string) {
    const metadataKey = `pipe/${name}/metadata.json`;
    try {
      const metadata = await PipeClient.fetch(client, bucket, metadataKey);
      const payload = await PipeClient.fetch(client, bucket, metadata.latest);

      return payload;
    } catch (err: any) {
      throw Error(`pipeFetchLatest Error: ${err}`);
    }
  }
}
