import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/config.js";
import { McpError } from "../utils/errors.js";

const READ_EXTENSIONS = new Set([".ase", ".aseprite", ".png", ".gif", ".json", ".pal", ".gpl"]);
const WRITE_EXTENSIONS = new Set([".ase", ".aseprite", ".png", ".gif", ".json", ".pal", ".gpl"]);

export class PathSecurity {
  readonly allowedDirectories: string[];
  readonly tempDirectory: string;

  constructor(private readonly config: AppConfig) {
    this.allowedDirectories = config.allowedDirectories.map((directory) =>
      path.resolve(config.rootDirectory, directory),
    );
    this.tempDirectory = path.resolve(config.rootDirectory, config.tempDirectory);
  }

  async ensureTempDirectory(): Promise<string> {
    await fs.mkdir(this.tempDirectory, { recursive: true });
    return this.tempDirectory;
  }

  resolveReadPath(inputPath: string): string {
    return this.resolvePath(inputPath, READ_EXTENSIONS, "read");
  }

  resolveWritePath(inputPath: string): string {
    return this.resolvePath(inputPath, WRITE_EXTENSIONS, "write");
  }

  async assertWritable(inputPath: string, overwrite?: boolean): Promise<string> {
    const resolved = this.resolveWritePath(inputPath);
    const exists = await this.exists(resolved);
    if (exists && !(overwrite ?? this.config.allowOverwrite)) {
      throw new McpError("FILE_EXISTS", `Refusing to overwrite existing file: ${resolved}`, { filePath: resolved });
    }
    return resolved;
  }

  private resolvePath(inputPath: string, extensions: Set<string>, mode: "read" | "write"): string {
    if (inputPath.includes("\0")) {
      throw new McpError("INVALID_PATH", "Path contains a null byte.");
    }
    const resolved = path.resolve(this.config.rootDirectory, inputPath);
    const extension = path.extname(resolved).toLowerCase();
    if (!extensions.has(extension)) {
      throw new McpError("INVALID_EXTENSION", `Extension ${extension || "<none>"} is not allowed for ${mode}.`, {
        extension,
        allowedExtensions: Array.from(extensions).sort(),
      });
    }
    const insideAllowedDirectory = this.allowedDirectories.some((directory) => {
      const relative = path.relative(directory, resolved);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
    if (!insideAllowedDirectory) {
      throw new McpError("PATH_OUTSIDE_ALLOWED_DIRECTORIES", "Path is outside the allowed directories.", {
        path: resolved,
        allowedDirectories: this.allowedDirectories,
      });
    }
    return resolved;
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
