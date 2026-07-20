import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema, OperationOptionsSchema, SpriteColorModeSchema } from "../../schemas/common.js";
import { ColorSchema, normalizeColor } from "../../utils/color.js";
import { toolResult } from "../tool-result.js";
import { ensureParentDirectory, createBackup } from "../../utils/file.js";

const CreateSpriteSchema = {
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  colorMode: SpriteColorModeSchema.default("rgb"),
  transparentColor: z.number().int().min(0).max(255).default(0),
  frameCount: z.number().int().min(1).default(1),
  frameDurationMs: z.number().int().min(1).default(100),
  background: ColorSchema.optional(),
  outputPath: FilePathSchema,
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

const FileSchema = {
  filePath: FilePathSchema,
};

const SaveSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  ...OperationOptionsSchema.shape,
};

export function registerDocumentTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_create_sprite",
    {
      title: "Create Aseprite sprite",
      description: "Create a new Aseprite sprite file with validated dimensions, frames, color mode, and optional background.",
      inputSchema: CreateSpriteSchema,
    },
    async (args) =>
      toolResult(async () => {
        if (args.width > context.config.maxWidth || args.height > context.config.maxHeight) {
          return {
            success: false,
            error: {
              code: "CANVAS_TOO_LARGE",
              message: "Canvas dimensions exceed configured limits.",
              details: { maxWidth: context.config.maxWidth, maxHeight: context.config.maxHeight },
            },
          };
        }
        if (args.frameCount > context.config.maxFrames) {
          return {
            success: false,
            error: {
              code: "TOO_MANY_FRAMES",
              message: "Frame count exceeds configured limit.",
              details: { maxFrames: context.config.maxFrames },
            },
          };
        }
        const outputPath = await context.paths.assertWritable(args.outputPath, args.overwrite);
        if (args.dryRun) {
          return { success: true, dryRun: true, outputPath };
        }
        await ensureParentDirectory(outputPath);
        return context.lua.runOperation("create_sprite", {
          ...args,
          outputPath,
          background: args.background ? normalizeColor(args.background) : undefined,
        });
      }),
  );

  server.registerTool(
    "aseprite_get_document_info",
    {
      title: "Get document info",
      description: "Inspect an Aseprite document and return structured metadata.",
      inputSchema: FileSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        return context.lua.runOperation("document_info", { filePath });
      }),
  );

  server.registerTool(
    "aseprite_list_layers",
    {
      title: "List layers",
      description: "Return the layers from an Aseprite document as JSON.",
      inputSchema: FileSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const result = (await context.lua.runOperation("document_info", { filePath })) as { document?: { layers?: unknown[] } };
        return { success: true, filePath, layers: result.document?.layers ?? [] };
      }),
  );

  server.registerTool(
    "aseprite_list_frames",
    {
      title: "List frames",
      description: "Return frame indexes, frame numbers, and durations.",
      inputSchema: FileSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const result = (await context.lua.runOperation("document_info", { filePath })) as { document?: { frames?: unknown[] } };
        return { success: true, filePath, frames: result.document?.frames ?? [] };
      }),
  );

  server.registerTool(
    "aseprite_save_document",
    {
      title: "Save document",
      description: "Save an Aseprite document in place or to a new path using controlled Lua.",
      inputSchema: SaveSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const outputPath = args.outputPath ? await context.paths.assertWritable(args.outputPath, args.overwrite) : filePath;
        if (args.dryRun) return { success: true, dryRun: true, filePath, outputPath };
        let backupPath: string | undefined;
        if (args.createBackup) backupPath = await createBackup(filePath);
        await ensureParentDirectory(outputPath);
        return context.locks.withFileLock(outputPath, async () => {
          const result = (await context.lua.runOperation("save_document", { filePath, outputPath })) as Record<string, unknown>;
          return { ...result, backupPath };
        });
      }),
  );
}
