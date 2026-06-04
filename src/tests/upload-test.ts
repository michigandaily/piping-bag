import { describe, it } from "node:test";

describe("Lambda function compression with archiver", () => {
  it("sucessfully compresses files", async () => {});
  it("successfully compresses directories", async () => {});
  it("successfully compresses buffers", async () => {});
});

describe("Lambda function bundler", async () => {
  it("exits when no zip directory is specified", async () => {});
  it("exits when specified lambda script does not exist", async () => {});
  it("successfully bundles javascript files", async () => {});
  it("skips .zip files", async () => {});
});

describe("Lambda function uploader", async () => {
  it("creates a new lambda function", async () => {});
  it("updates an existing lambda function", async () => {});
  it("detects identical scripts and skips code upload step", async () => {});
  it("updates an existing lambda function configuration", async () => {});
});
