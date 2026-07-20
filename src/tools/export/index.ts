import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema } from "../../schemas/common.js";
import { buildExportPngArgs, buildExportSpritesheetArgs } from "../../aseprite/command-builder.js";
import { ensureParentDirectory } from "../../utils/file.js";
import { toolResult } from "../tool-result.js";

const ExportPngSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema,
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

const ExportSpritesheetSchema = {
  filePath: FilePathSchema,
  sheetPath: FilePathSchema,
  dataPath: FilePathSchema.optional(),
  sheetType: z.enum(["horizontal", "vertical", "rows", "columns", "packed"]).default("packed"),
  rows: z.number().int().min(1).optional(),
  columns: z.number().int().min(1).optional(),
  scale: z.number().positive().optional(),
  trim: z.boolean().default(false),
  mergeDuplicates: z.boolean().default(false),
  listLayers: z.boolean().default(true),
  listTags: z.boolean().default(true),
  listSlices: z.boolean().default(true),
  filenameFormat: z.string().min(1).max(256).optional(),
  format: z.enum(["json-array", "json-hash"]).default("json-array"),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

interface DocumentInfoResult {
  document?: {
    frames?: unknown[];
  };
}

function asepriteSaveAsSequencePaths(outputPath: string, frameCount: number): string[] {
  if (frameCount <= 1) return [outputPath];
  const parsed = path.parse(outputPath);
  return Array.from({ length: frameCount }, (_, index) =>
    path.join(parsed.dir, `${parsed.name}${index + 1}${parsed.ext}`),
  );
}

async function existingGeneratedPaths(outputPath: string): Promise<string[]> {
  const parsed = path.parse(outputPath);
  const sequencePattern = new RegExp(`^${escapeRegex(parsed.name)}\\d+${escapeRegex(parsed.ext)}$`);
  try {
    const entries = await fs.readdir(parsed.dir);
    return entries
      .filter((entry) => entry === parsed.base || sequencePattern.test(entry))
      .map((entry) => path.join(parsed.dir, entry));
  } catch {
    return [];
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function registerExportTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_export_png",
    {
      title: "Export PNG",
      description: "Export an Aseprite document to PNG through the official CLI --save-as option.",
      inputSchema: ExportPngSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const outputPath = await context.paths.assertWritable(args.outputPath, args.overwrite);
        const info = (await context.lua.runOperation("document_info", { filePath })) as DocumentInfoResult;
        const frameCount = info.document?.frames?.length ?? 1;
        const expectedPaths = asepriteSaveAsSequencePaths(outputPath, frameCount);
        for (const expectedPath of expectedPaths) {
          await context.paths.assertWritable(expectedPath, args.overwrite);
        }
        const cliArgs = buildExportPngArgs(filePath, outputPath);
        if (args.dryRun) {
          return { success: true, dryRun: true, command: "aseprite", args: cliArgs, expectedPaths };
        }
        await ensureParentDirectory(outputPath);
        const result = await context.cli.run(cliArgs);
        const generatedPaths = await existingGeneratedPaths(outputPath);
        return { success: true, filePath, outputPath, generatedPaths, stdout: result.stdout, stderr: result.stderr };
      }),
  );

  server.registerTool(
    "aseprite_export_spritesheet",
    {
      title: "Export spritesheet",
      description: "Export a spritesheet and optional JSON metadata through official Aseprite CLI options.",
      inputSchema: ExportSpritesheetSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const sheetPath = await context.paths.assertWritable(args.sheetPath, args.overwrite);
        const dataPath = args.dataPath ? await context.paths.assertWritable(args.dataPath, args.overwrite) : undefined;
        const cliArgs = buildExportSpritesheetArgs({ ...args, inputPath: filePath, sheetPath, dataPath });
        if (args.dryRun) return { success: true, dryRun: true, command: "aseprite", args: cliArgs };
        await ensureParentDirectory(sheetPath);
        if (dataPath) await ensureParentDirectory(dataPath);
        const result = await context.cli.run(cliArgs);
        let metadata: unknown;
        if (dataPath) {
          metadata = JSON.parse(await fs.readFile(dataPath, "utf8"));
        }
        return { success: true, filePath, sheetPath, dataPath, metadata, stdout: result.stdout, stderr: result.stderr };
      }),
  );
}
