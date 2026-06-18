import EventEmitter from "node:events";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import { currentUnix, toUnix } from "./helpers/_time.js";
import { load_config } from "./helpers/_utils.js";
import { DEFAULT_REGION, DEFAULT_TIMEZONE } from "./helpers/_defaults.js";
import {
  type PipeData,
  type PipeMetadata,
  type SchedulerDate,
  PollingType,
} from "./helpers/types.js";

/**
 * A polling client wrapper around the S3 API. Allows
 * registering listeners to poll a specified S3 directory
 * at a fixed interval.
 */
export class PipeClient {
  client: S3Client;
  name: string;
  bucket: string;
  useCache: boolean;
  data: Record<number, any>;

  poller!: ReturnType<typeof setTimeout> | undefined;
  started!: boolean;
  emitter!: EventEmitter;

  /**
   * @param name - The name of the piping-bag pipeline
   * @param region - The AWS region the pipeline is deployed at
   * @param bucket - The S3 bucket where the data is stored
   * @param useCache - Optional flag on whether to use the browser cache. Defaults to true.
   */
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

  /**
   * Custom asynchronous constructor that reads your pipe.config.js in your project
   * directory to create a PipeClient.
   * @param opts - Configuration for optional overrides to default PipeClient construction.
   * @param opts.useCache - Optional flag on whether to use the browser cache. Defaults to true.
   */
  static async Init(opts?: { useCache: boolean }) {
    const { config } = (await load_config())!;
    const { name, region = DEFAULT_REGION } = config;
    const { bucket } = config.schema;

    return new PipeClient({
      name,
      region,
      bucket,
      useCache: opts ? opts.useCache : true,
    });
  }

  /**
   * @param id - Optional parameter that defines a specific timestamp to return.
   * If not provided all fetched data is returned.
   */
  getData(id?: number) {
    if (id) {
      return this.data[id];
    }
    return this.data;
  }

  /**
   * Clears all stored data that was fetched from S3. Also clears the browser cache.
   */
  clearData() {
    // TODO: clear browser/clientside cache
    this.data = {};
  }

  /**
   * @param type - Defines the polling type. Timeline ("change") fetches the entire
   * timeline of data while Latest ("update") fetches the file with the latest timestamp
   * @param interval - Defines the frequency interval which data from S3 is polled in milliseconds
   */
  startPoll(type: PollingType = PollingType.Latest, interval: number = 50000) {
    this.emitter = new EventEmitter();

    // TODO: set data in browser/clientside cache and pull
    // from there if it exists and useCache is true
    const poll = async () => {
      switch (type) {
        case PollingType.Latest:
          const entry = await PipeClient.fetchLatest(
            this.client,
            this.name,
            this.bucket,
          );

          this.data = Object.assign(this.data, entry);
          this.emitter.emit(type, entry);
          break;
        case PollingType.Timeline:
          const recent = Math.max(...Object.keys(this.data).map((k) => +k), 0);
          const entries = await PipeClient.fetchRange(
            this.client,
            this.name,
            this.bucket,
            [recent, currentUnix()],
          );

          this.data = Object.assign(this.data, ...entries);
          this.emitter.emit(type, this.data);
          break;
      }

      let id;
      if (this.started) {
        id = setTimeout(poll, interval);
      }
      return id;
    };

    this.started = true;
    poll().then((id) => {
      this.poller = id;
    });

    return this.emitter;
  }

  /**
   * Ends a poll if started. Stops all scheduled S3 fetches and removes all listeners.
   */
  endPoll() {
    this.started = false;
    clearTimeout(this.poller);
    this.emitter.removeAllListeners();
  }

  /**
   * @param id - Defines the polling type. Timeline ("change") fetches the entire
   * timeline of data while Latest ("update") fetches the file with the latest timestamp
   * @param interval - Defines the frequency interval which data from S3 is polled in milliseconds
   * @param callback - A callback function that fires every time the data is polled and updated.
   * Use this to redraw/update a live display of the data.
   */
  listen(id: PollingType, interval: number, callback: (event: any[]) => {}) {
    this.startPoll(id, interval).on(id, (event: any[]) => {
      callback(event);
    });
  }

  /**
  * A static member function for fetching straight from S3. It is recommended  
  * you use the listener API, which uses these functions and handles configuration details for you.
  * However, these static functions can be used if you would like a more flexible/low level API.
  * @param client - Add an S3 Client. Make sure to initialize the client with empty credential strings.
  * Do not expose AWS credentials to the client.
  * @param bucket - Specifies the S3 bucket to fetch from.
  * @param key - Specifies the key to fetch from.
  * @example 
  * const client = new S3Client({
      region,
      // An empty credentials object is required to prevent
      // a credentials error
      credentials: {
        accessKeyId: "",
        secretAccessKey: "",
      },
      signer: { sign: async (request) => request },
    });
    const data = await PipeClient.fetch(client, bucket, key)
  */
  static async fetch(
    client: S3Client,
    bucket: string,
    key: string,
  ): Promise<PipeData> {
    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const payload = await object
      .Body!.transformToString()
      .then((data) => JSON.parse(data));

    const filename = key.split("/").at(-1);
    const [timestamp] = filename!.split(".");

    return { timestamp: +timestamp!, ...payload };
  }

  /**
  * A static member function for fetching straight from S3. It is recommended 
  * you use the listener API, which uses these functions and handles configuration details for you.
  * However, these static functions can be used if you would like a more flexible/low level API.
  * @param client - Add an S3 Client. Make sure to initialize the client with empty credential strings.
  * Do not expose AWS credentials to the client.
  * @param name - Specifies the name of the piping-bag pipeline.
  * @param bucket - Specifies the S3 bucket to fetch from.
  * @example 
  * const client = new S3Client({
      region,
      // An empty credentials object is required to prevent
      // a credentials error
      credentials: {
        accessKeyId: "",
        secretAccessKey: "",
      },
      signer: { sign: async (request) => request },
    });
    const data = await PipeClient.fetchMetadata(client, name, bucket)
  *
  */
  static async fetchMetadata(
    client: S3Client,
    name: string,
    bucket: string,
  ): Promise<PipeMetadata> {
    const key = `pipe/${name}/metadata.json`;
    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const payload = await object
      .Body!.transformToString()
      .then((data) => JSON.parse(data));

    return payload;
  }

  /**
  * A static member function for fetching straight from S3. It is recommended 
  * you use the listener API, which uses these functions and handles configuration details for you.
  * However, these static functions can be used if you would like a more flexible/low level API.
  * @param client - Add an S3 Client. Make sure to initialize the client with empty credential strings.
  * Do not expose AWS credentials to the client.
  * @param name - Specifies the name of the piping-bag pipeline.
  * @param bucket - Specifies the S3 bucket to fetch from.
  * @param range - Specifies the the time range in which all files written during will be returned
  * @param timezone - Specifies the timezone of the provided date range
  * @example 
  * const client = new S3Client({
      region,
      // An empty credentials object is required to prevent
      // a credentials error
      credentials: {
        accessKeyId: "",
        secretAccessKey: "",
      },
      signer: { sign: async (request) => request },
    });
    const data = await PipeClient.fetch(client, bucket, key)
  */
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

      return Promise.all(promises).then((entries: PipeData[]) =>
        entries.map((entry) => ({ [entry.timestamp]: entry.data })),
      );
    } catch (err: any) {
      throw Error(`pipeFetch Error: ${err}`);
    }
  }

  /**
  * A static member function for fetching straight from S3. It is recommended 
  * you use the listener API, which uses these functions and handles configuration details for you.
  * However, these static functions can be used if you would like a more flexible/low level API.
  * @param client - Add an S3 Client. Make sure to initialize the client with empty credential strings.
  * Do not expose AWS credentials to the client.
  * @param name - Specifies the name of the piping-bag pipeline.
  * @param bucket - Specifies the S3 bucket to fetch from.
  * @example 
  * const client = new S3Client({
      region,
      // An empty credentials object is required to prevent
      // a credentials error
      credentials: {
        accessKeyId: "",
        secretAccessKey: "",
      },
      signer: { sign: async (request) => request },
    });
    const data = await PipeClient.fetch(client, bucket, key)
  */
  static async fetchLatest(client: S3Client, name: string, bucket: string) {
    try {
      const { latest } = await PipeClient.fetchMetadata(client, name, bucket);
      const payload = await PipeClient.fetch(client, bucket, latest);

      return { [payload.timestamp]: payload.data };
    } catch (err: any) {
      throw Error(`pipeFetchLatest Error: ${err}`);
    }
  }
}
