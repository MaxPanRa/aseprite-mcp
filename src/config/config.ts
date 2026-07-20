import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const stringListFromEnv = (value: string | undefined, fallback: string[]): string[] => {
  if (value === undefined || value.trim() === "") return fallback;
  return value
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const ConfigSchema = z.object({
  asepritePath: z.string().nullable().optional(),
  allowedDirectories: z.array(z.string()).min(1).default(["."]),
  tempDirectory: z.string().default(".aseprite-mcp-temp"),
  maxWidth: z.number().int().positive().default(4096),
  maxHeight: z.number().int().positive().default(4096),
  maxFrames: z.number().int().positive().default(512),
  maxPixelsPerCall: z.number().int().positive().default(50000),
  processTimeoutMs: z.number().int().positive().default(30000),
  maxProcessOutputBytes: z.number().int().positive().default(2_000_000),
  allowOverwrite: z.boolean().default(false),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  rootDirectory: string;
  configPath?: string;
};

async function loadConfigFile(configPath: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function loadConfig(): Promise<AppConfig> {
  const rootDirectory = process.cwd();
  const configPath = process.env.ASEPRITE_MCP_CONFIG ?? path.join(rootDirectory, "aseprite-mcp.config.json");
  const fileConfig = await loadConfigFile(configPath);
  const merged = {
    ...(typeof fileConfig === "object" && fileConfig !== null ? fileConfig : {}),
    asepritePath: process.env.ASEPRITE_PATH || (fileConfig as { asepritePath?: string }).asepritePath,
    allowedDirectories: stringListFromEnv(
      process.env.ASEPRITE_MCP_ALLOWED_DIRECTORIES,
      (fileConfig as { allowedDirectories?: string[] }).allowedDirectories ?? ["."],
    ),
    tempDirectory: process.env.ASEPRITE_MCP_TEMP_DIRECTORY ?? (fileConfig as { tempDirectory?: string }).tempDirectory,
    maxWidth: numberFromEnv(process.env.ASEPRITE_MCP_MAX_WIDTH, (fileConfig as { maxWidth?: number }).maxWidth ?? 4096),
    maxHeight: numberFromEnv(process.env.ASEPRITE_MCP_MAX_HEIGHT, (fileConfig as { maxHeight?: number }).maxHeight ?? 4096),
    maxFrames: numberFromEnv(process.env.ASEPRITE_MCP_MAX_FRAMES, (fileConfig as { maxFrames?: number }).maxFrames ?? 512),
    processTimeoutMs: numberFromEnv(
      process.env.ASEPRITE_MCP_PROCESS_TIMEOUT,
      (fileConfig as { processTimeoutMs?: number }).processTimeoutMs ?? 30000,
    ),
    allowOverwrite: boolFromEnv(
      process.env.ASEPRITE_MCP_ALLOW_OVERWRITE,
      (fileConfig as { allowOverwrite?: boolean }).allowOverwrite ?? false,
    ),
    logLevel: process.env.ASEPRITE_MCP_LOG_LEVEL ?? (fileConfig as { logLevel?: string }).logLevel,
  };

  return {
    ...ConfigSchema.parse(merged),
    rootDirectory,
    configPath,
  };
}
