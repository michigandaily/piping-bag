import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";

import type {
  CreateFunctionCommandOutput,
  UpdateFunctionCodeCommandOutput,
  UpdateFunctionConfigurationCommandOutput,
} from "@aws-sdk/client-lambda";

import { fixtures, mockLambdaClient } from "./helpers.js";

mock.module("../lib/helpers/_utils.js", {
  namedExports: {
    ...(await import("../lib/helpers/_utils.js")),
    waitUntilUpdated: async (
      _: string,
      __: string,
      lambdaClientCommand: () => Promise<any>,
    ) => lambdaClientCommand(),
  },
});
const { uploadFunction, zipFiles } = await import("../lib/cli/upload.js");

describe("Lambda function compression with archiver", () => {
  beforeEach(() => {
    mkdirSync(fixtures("tmp"), { recursive: true });

    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    mock.method(console, "warn", () => {});
    mock.method(console, "info", () => {});
  });

  afterEach(() => {
    rmSync(fixtures("tmp/"), { recursive: true });

    mock.restoreAll();
  });

  it("sucessfully compresses files", async () => {
    const dir = await zipFiles({
      files: [fixtures("basic/pipe.config.json")],
      buffers: [],
      outputDir: fixtures("tmp/basic.zip"),
    });

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
  });

  it("successfully compresses directories", async () => {
    const dir = await zipFiles({
      files: [fixtures("basic")],
      buffers: [],
      outputDir: fixtures("tmp/basic.zip"),
    });

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
  });

  it("successfully compresses buffers", async () => {
    const dir = await zipFiles({
      files: [],
      buffers: [
        { name: "pipe.config.json", body: JSON.stringify({ key: "value" }) },
      ],
      outputDir: fixtures("tmp/basic.zip"),
    });

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
  });

  it("successfully compresses all data formats", async () => {
    const dir = await zipFiles({
      files: [fixtures("basic/pipe.config.json"), fixtures("basic")],
      buffers: [
        { name: "pipe.config.json", body: JSON.stringify({ key: "value" }) },
      ],
      outputDir: fixtures("tmp/basic.zip"),
    });

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
  });
});

describe("Lambda function bundler", async () => {
  it("exits when no zip directory is specified", async () => {});
  it("exits when specified lambda script does not exist", async () => {});
  it("successfully bundles javascript files", async () => {});
  it("skips .zip files", async () => {});
});

describe("Lambda function uploader", async () => {
  beforeEach(() => {
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    mock.method(console, "warn", () => {});
    mock.method(console, "info", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("creates a new lambda function", async () => {
    const mockClient = mockLambdaClient({
      GetFunction: {
        Error: {
          Name: "ResourceNotFoundException",
          Message: "Function not found",
        },
      },
    });
    const [_, res] = (await uploadFunction(
      {
        name: "scraper",
        role: "pipe-lambda",
        region: "us-east-2",
        handler: "scraper.main",
        mem_size: 512,
        timeout: 10,
        code: Buffer.alloc(0),
      },
      mockClient,
    )) as unknown as [
      undefined,
      CreateFunctionCommandOutput & { CommandName: string },
    ];

    assert.strictEqual(res.CommandName, "CreateFunctionCommand");
    assert.strictEqual(res.FunctionName, "scraper");
    assert.strictEqual(res.Role, "pipe-lambda");
    assert.strictEqual(res.Handler, "scraper.main");
    assert.strictEqual(res.MemorySize, 512);
    assert.strictEqual(res.Timeout, 10);
  });

  it("updates an existing lambda function", async () => {
    const mockClient = mockLambdaClient({});
    const [resCode, resConfig] = (await uploadFunction(
      {
        name: "scraper",
        role: "pipe-lambda",
        region: "us-east-2",
        handler: "scraper.main",
        mem_size: 512,
        timeout: 10,
        code: Buffer.alloc(0),
      },
      mockClient,
    )) as unknown as [
      UpdateFunctionCodeCommandOutput & { CommandName: string },
      UpdateFunctionConfigurationCommandOutput & { CommandName: string },
    ];

    assert.strictEqual(resCode.CommandName, "UpdateFunctionCodeCommand");
    assert.strictEqual(resCode.FunctionName, "scraper");
    assert.strictEqual(
      resConfig.CommandName,
      "UpdateFunctionConfigurationCommand",
    );
    assert.strictEqual(resConfig.Role, "pipe-lambda");
    assert.strictEqual(resConfig.Handler, "scraper.main");
    assert.strictEqual(resConfig.MemorySize, 512);
    assert.strictEqual(resConfig.Timeout, 10);
  });

  it("detects identical scripts and skips code upload step", async () => {
    const code = Buffer.from("console.log('Hello World')");
    const hash = createHash("sha256").update(code).digest("base64");
    const mockClient = mockLambdaClient({
      GetFunctionConfiguration: {
        CodeSha256: hash,
      },
    });
    const [resCode, resConfig] = (await uploadFunction(
      {
        name: "scraper",
        role: "pipe-lambda",
        region: "us-east-2",
        handler: "scraper.main",
        mem_size: 512,
        timeout: 10,
        code: code,
      },
      mockClient,
    )) as unknown as [
      UpdateFunctionCodeCommandOutput & { CommandName: string },
      UpdateFunctionConfigurationCommandOutput & { CommandName: string },
    ];

    assert.strictEqual(resCode, undefined);
    assert.strictEqual(
      resConfig.CommandName,
      "UpdateFunctionConfigurationCommand",
    );
    assert.strictEqual(resConfig.FunctionName, "scraper");
    assert.strictEqual(
      resConfig.CommandName,
      "UpdateFunctionConfigurationCommand",
    );
    assert.strictEqual(resConfig.Role, "pipe-lambda");
    assert.strictEqual(resConfig.Handler, "scraper.main");
    assert.strictEqual(resConfig.MemorySize, 512);
    assert.strictEqual(resConfig.Timeout, 10);
  });
});
