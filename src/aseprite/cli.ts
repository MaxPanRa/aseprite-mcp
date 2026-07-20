import { spawn } from "node:child_process";
import type { AppConfig } from "../config/config.js";
import type { AsepriteDiscovery } from "./discovery.js";
import { McpError } from "../utils/errors.js";

export interface CliResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class AsepriteCli {
  constructor(
    private readonly config: AppConfig,
    private readonly discovery: AsepriteDiscovery,
  ) {}

  async run(args: string[], timeoutMs = this.config.processTimeoutMs): Promise<CliResult> {
    const info = await this.discovery.detect();
    if (!info.path) {
      throw new McpError("ASEPRITE_NOT_FOUND", "Aseprite executable was not found.", {
        checkedPaths: info.checkedPaths,
        hint: "Set ASEPRITE_PATH or asepritePath in aseprite-mcp.config.json.",
      });
    }

    return new Promise((resolve, reject) => {
      const child = spawn(info.path as string, args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      let killedByTimeout = false;
      const timer = setTimeout(() => {
        killedByTimeout = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      const append = (current: string, chunk: Buffer): string => {
        const next = current + chunk.toString("utf8");
        if (next.length > this.config.maxProcessOutputBytes) {
          child.kill("SIGTERM");
          throw new McpError("PROCESS_OUTPUT_LIMIT", "Aseprite produced too much output.", {
            maxBytes: this.config.maxProcessOutputBytes,
          });
        }
        return next;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = append(stderr, chunk);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(new McpError("ASEPRITE_PROCESS_ERROR", error.message, { command: info.path, args }));
      });
      child.once("exit", (exitCode) => {
        clearTimeout(timer);
        if (killedByTimeout) {
          reject(new McpError("ASEPRITE_TIMEOUT", "Aseprite process timed out.", { timeoutMs, args }));
          return;
        }
        const result = { command: info.path as string, args, stdout, stderr, exitCode };
        if (exitCode !== 0) {
          reject(new McpError("ASEPRITE_EXIT_ERROR", "Aseprite exited with a non-zero status.", result));
          return;
        }
        resolve(result);
      });
    });
  }
}
