import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../src/config/config.js";
import { PathSecurity } from "../../src/security/path-security.js";

const rootDirectory = process.cwd();

function config(): AppConfig {
  return {
    rootDirectory,
    asepritePath: null,
    allowedDirectories: ["."],
    tempDirectory: ".aseprite-mcp-temp",
    maxWidth: 4096,
    maxHeight: 4096,
    maxFrames: 512,
    maxPixelsPerCall: 50000,
    processTimeoutMs: 30000,
    maxProcessOutputBytes: 2_000_000,
    allowOverwrite: false,
    logLevel: "info",
  };
}

describe("PathSecurity", () => {
  it("resolves allowed sprite paths", () => {
    const paths = new PathSecurity(config());
    expect(paths.resolveReadPath("examples/output/player.aseprite")).toBe(
      path.resolve(rootDirectory, "examples/output/player.aseprite"),
    );
  });

  it("allows palette export paths", () => {
    const paths = new PathSecurity(config());
    expect(paths.resolveWritePath("examples/output/player.gpl")).toBe(
      path.resolve(rootDirectory, "examples/output/player.gpl"),
    );
  });

  it("rejects unsupported extensions", () => {
    const paths = new PathSecurity(config());
    expect(() => paths.resolveReadPath("script.lua")).toThrow(/Extension/);
  });

  it("rejects path traversal outside allowed directories", () => {
    const paths = new PathSecurity({ ...config(), allowedDirectories: ["examples"] });
    expect(() => paths.resolveReadPath("../outside.aseprite")).toThrow(/outside the allowed/);
  });
});
