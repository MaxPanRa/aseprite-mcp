import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AppConfig } from "../config/config.js";

export interface AsepriteInfo {
  path: string | null;
  version: string | null;
  available: boolean;
  checkedPaths: string[];
}

export class AsepriteDiscovery {
  private cached?: Promise<AsepriteInfo>;

  constructor(private readonly config: AppConfig) {}

  async detect(): Promise<AsepriteInfo> {
    this.cached ??= this.detectUncached();
    return this.cached;
  }

  private async detectUncached(): Promise<AsepriteInfo> {
    const candidates = this.candidates();
    for (const candidate of candidates) {
      if (await this.isExecutableCandidate(candidate)) {
        return {
          path: candidate,
          version: await this.readVersion(candidate),
          available: true,
          checkedPaths: candidates,
        };
      }
    }
    return { path: null, version: null, available: false, checkedPaths: candidates };
  }

  private candidates(): string[] {
    const configured = this.config.asepritePath ? [this.config.asepritePath] : [];
    const windowsDefaults =
      process.platform === "win32"
        ? [
            "C:\\Program Files\\Aseprite\\Aseprite.exe",
            "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
            "C:\\Program Files\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
          ]
        : [];
    return [...configured, "aseprite", "Aseprite", ...windowsDefaults].map((entry) =>
      path.isAbsolute(entry) ? entry : entry,
    );
  }

  private async isExecutableCandidate(candidate: string): Promise<boolean> {
    if (!path.isAbsolute(candidate)) {
      return this.canSpawn(candidate);
    }
    try {
      const stat = await fs.stat(candidate);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async canSpawn(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(command, ["--version"], { windowsHide: true });
      child.once("error", () => resolve(false));
      child.once("exit", () => resolve(true));
    });
  }

  private async readVersion(command: string): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn(command, ["--version"], { windowsHide: true });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
      child.once("error", () => resolve(null));
      child.once("exit", () => resolve(output.trim() || null));
    });
  }
}
