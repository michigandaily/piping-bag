import { mkdirSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";

import type { CreateFunctionCommandInput } from "@aws-sdk/client-lambda";

import { uploadFunction, zipFiles } from "../lib/cli/upload.js";
import { fixtures, mockLambdaClient } from "./helpers.js";

describe("Lambda function compression with archiver", () => {
  beforeEach(() => {
    mkdirSync(fixtures("tmp"), { recursive: true });
  });

  afterEach(() => {
    rmSync(fixtures("tmp/"), { recursive: true });
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
  it("creates a new lambda function", async () => {
    const mockClient = mockLambdaClient({
      GetFunction: {
        Error: {
          Name: "ResourceNotFoundException",
          Message: "Function not found",
        },
      },
    });
    const res = (await uploadFunction(
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
    )) as unknown as CreateFunctionCommandInput & { CommandName: string };

    assert.strictEqual(res.CommandName!, "CreateFunctionCommand");
    assert.strictEqual(res.FunctionName, "scraper");
    assert.strictEqual(res.Role, "pipe-lambda");
    assert.strictEqual(res.Handler, "scraper.main");
    assert.strictEqual(res.MemorySize, 512);
    assert.strictEqual(res.Timeout, 10);
  });

  it("updates an existing lambda function", async () => {});
  it("detects identical scripts and skips code upload step", async () => {});
  it("updates an existing lambda function configuration", async () => {});
});
