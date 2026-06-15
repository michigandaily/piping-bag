import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import EventEmitter from "node:events";

import { DEFAULT_REGION, DEFAULT_TIMEZONE } from "./helpers/_defaults.js";
import { type SchedulerDate, PollingType } from "./helpers/types.js";
import { currentUnix, toUnix } from "./helpers/_time.js";

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
      // An empty credentials object is required to prevent
      // a credentials error
      credentials: {
        accessKeyId: "",
        secretAccessKey: "",
      },
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
    // TODO: clear browser/clientside cache
    this.data = {};
  }

  startPoll(type: PollingType = PollingType.Latest, interval: number = 50000) {
    this.emitter = new EventEmitter();

    // TODO: set data in browser/clientside cache and pull
    // from there if it exists and useCache is true
    this.poller = setInterval(async () => {
      switch (type) {
        case PollingType.Latest:
          const entry = await PipeClient.fetchLatest(
            this.client,
            this.name,
            this.bucket,
          );

          this.data = Object.assign(this.data, entry);
          this.emitter.emit(type, entry);
        case PollingType.Timeline:
          const recent = Math.max(...Object.keys(this.data).map((k) => +k), 0);
          const entries = await PipeClient.fetchRange(
            this.client,
            this.name,
            this.bucket,
            [recent, currentUnix()],
          );

          this.data = Object.assign(this.data, ...entries);
          this.emitter.emit(type, this.getData());
      }
    }, interval);

    return this.emitter;
  }

  endPoll() {
    clearInterval(this.poller);
    this.emitter.removeAllListeners();
  }

  listen(id: PollingType, interval: number, callback: (event: any[]) => {}) {
    this.startPoll(id, interval).on(id, (event: any[]) => {
      callback(event);
    });
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

    const filename = key.split("/").at(-1);
    const [timestamp] = filename!.split(".");

    return { timestamp: +timestamp!, ...payload };
  }

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
          Bucket: `${bucket}`,
          Prefix: `pipe/${name}/`,
        }),
      );

      const entries = res.Contents!.filter((entry) => {
        const filename = entry.Key!.split("/").at(-1);
        const [timestamp] = filename!.split(".");
        if (timestamp === "metadata") {
          return false;
        }

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
      const { data } = await PipeClient.fetch(client, bucket, metadataKey);
      const payload = await PipeClient.fetch(client, bucket, data.latest);

      return payload;
    } catch (err: any) {
      throw Error(`pipeFetchLatest Error: ${err}`);
    }
  }
}
