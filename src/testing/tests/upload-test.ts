import path from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";

import type {
  CreateFunctionCommandOutput,
  UpdateFunctionCodeCommandOutput,
  UpdateFunctionConfigurationCommandOutput,
} from "@aws-sdk/client-lambda";

import { fixtures, mockLambdaClient, unpack } from "../helpers.js";
import { load_config } from "../../lib/helpers/_utils.js";

mock.module("../../lib/helpers/_utils.js", {
  namedExports: {
    ...(await import("../../lib/helpers/_utils.js")),
    waitUntilUpdated: async (
      _: string,
      __: string,
      lambdaClientCommand: () => Promise<any>,
    ) => lambdaClientCommand(),
  },
});
const { zipFiles, bundleHandlers, uploadFunction } =
  await import("../../lib/cli/upload.js");

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
    const unzipped = unpack(fixtures("tmp/basic.zip"));
    const expected = readFileSync(fixtures("basic/pipe.config.json"));

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
    assert.strictEqual(
      unzipped["pipe.config.json"]?.toString("ascii"),
      expected.toString("ascii"),
    );
  });

  it("successfully compresses directories", async () => {
    const dir = await zipFiles({
      files: [fixtures("basic")],
      buffers: [],
      outputDir: fixtures("tmp/basic.zip"),
    });
    const unzipped = unpack(fixtures("tmp/basic.zip"));
    const expected = readFileSync(fixtures("basic/pipe.config.json"));

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
    assert.strictEqual(
      unzipped[fixtures("basic/pipe.config.json")]?.toString("ascii"),
      expected.toString("ascii"),
    );
  });

  it("successfully compresses buffers", async () => {
    const body = JSON.stringify({ key: "value" });
    const dir = await zipFiles({
      files: [],
      buffers: [{ name: "pipe.config.json", body }],
      outputDir: fixtures("tmp/basic.zip"),
    });
    const unzipped = unpack(fixtures("tmp/basic.zip"));

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
    assert.strictEqual(unzipped["pipe.config.json"]?.toString("ascii"), body);
  });

  it("successfully compresses all data formats", async () => {
    const body = JSON.stringify({ key: "value" });
    const dir = await zipFiles({
      files: [fixtures("basic/pipe.config.json"), fixtures("basic")],
      buffers: [
        {
          name: "example.pipe.config.json",
          body,
        },
      ],
      outputDir: fixtures("tmp/basic.zip"),
    });
    const unzipped = unpack(fixtures("tmp/basic.zip"));
    const expected = readFileSync(fixtures("basic/pipe.config.json"));

    assert.strictEqual(dir, fixtures("tmp/basic.zip"));
    assert.strictEqual(
      unzipped["pipe.config.json"]?.toString("ascii"),
      expected.toString("ascii"),
    );
    assert.strictEqual(
      unzipped[fixtures("basic/pipe.config.json")]?.toString("ascii"),
      expected.toString("ascii"),
    );
    assert.strictEqual(
      unzipped["example.pipe.config.json"]?.toString("ascii"),
      body,
    );
  });
});

describe("Lambda function bundler", async () => {
  beforeEach(() => {
    execSync("pnpm run build", {
      cwd: path.resolve(import.meta.dirname, ""),
      stdio: "pipe",
    });
    execSync("pnpm install", { cwd: fixtures("js"), stdio: "pipe" });

    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    mock.method(console, "warn", () => {});
    mock.method(console, "info", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it(
    "exits when no zip directory is specified",
    {
      expectFailure: {
        label: "zip directory not specified",
        match:
          /Zip directory destination path is not defined in pipe configuration/,
      },
    },
    async () => {
      const { config } = (await load_config(fixtures("js/pipe.config.js")))!;
      await bundleHandlers(
        {
          path: fixtures("js/example.js"),
          handler: "example.main",
          zip_dir: "",
        },
        config,
      );
    },
  );

  it(
    "exits when specified lambda script does not exist",
    {
      expectFailure: {
        label:
          "specified path not specified and given handler file does not exist",
        match:
          /No files found for provided handler, please provide a valid path or handler in the pipe configuration./,
      },
    },
    async () => {
      const { config } = (await load_config(fixtures("js/pipe.config.js")))!;
      await bundleHandlers(
        {
          path: "",
          handler: "null.main",
          zip_dir: fixtures("tmp"),
        },
        config,
      );
    },
  );

  it("successfully bundles javascript files", async () => {
    const { config } = (await load_config(fixtures("js/pipe.config.js")))!;
    const lambdaDir = await bundleHandlers(
      {
        path: fixtures("js/example.js"),
        handler: "example.main",
        zip_dir: fixtures("tmp"),
      },
      config,
    );

    assert.strictEqual(lambdaDir, fixtures("tmp/example.zip"));
  });

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
