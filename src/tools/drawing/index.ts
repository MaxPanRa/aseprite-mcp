import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema, OperationOptionsSchema, PixelSchema } from "../../schemas/common.js";
import { ColorSchema } from "../../utils/color.js";
import { normalizeColor } from "../../utils/color.js";
import { createBackup, ensureParentDirectory } from "../../utils/file.js";
import { toolResult } from "../tool-result.js";

const SetPixelsSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameIndex: z.number().int().min(1).default(1),
  layerIndex: z.number().int().min(1).default(1),
  pixels: z.array(PixelSchema).min(1),
  ...OperationOptionsSchema.shape,
};

const RegionSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameIndex: z.number().int().min(1).default(1),
  layerIndex: z.number().int().min(1).default(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  color: ColorSchema.optional(),
  ...OperationOptionsSchema.shape,
};

const LineSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameIndex: z.number().int().min(1).default(1),
  layerIndex: z.number().int().min(1).default(1),
  x1: z.number().int().min(0),
  y1: z.number().int().min(0),
  x2: z.number().int().min(0),
  y2: z.number().int().min(0),
  color: ColorSchema,
  ...OperationOptionsSchema.shape,
};

const RectangleSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameIndex: z.number().int().min(1).default(1),
  layerIndex: z.number().int().min(1).default(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  color: ColorSchema,
  filled: z.boolean().default(false),
  ...OperationOptionsSchema.shape,
};

async function runDrawingOperation(
  context: AppContext,
  args: {
    filePath: string;
    outputPath?: string;
    overwrite?: boolean;
    dryRun?: boolean;
    createBackup?: boolean;
  },
  operation: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const filePath = context.paths.resolveReadPath(args.filePath);
  const outputPath = args.outputPath ? await context.paths.assertWritable(args.outputPath, args.overwrite) : filePath;
  if (args.dryRun) return { success: true, dryRun: true, filePath, outputPath, operation };
  let backupPath: string | undefined;
  if (args.createBackup) backupPath = await createBackup(filePath);
  await ensureParentDirectory(outputPath);
  return context.locks.withFileLock(outputPath, async () => {
    const result = (await context.lua.runOperation(operation, { ...payload, filePath, outputPath })) as Record<string, unknown>;
    return { ...result, backupPath };
  });
}

export function registerDrawingTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_set_pixels",
    {
      title: "Set pixels",
      description: "Set many pixels in one call using compact pixel entries.",
      inputSchema: SetPixelsSchema,
    },
    async (args) =>
      toolResult(async () => {
        if (args.pixels.length > context.config.maxPixelsPerCall) {
          return {
            success: false,
            error: {
              code: "TOO_MANY_PIXELS",
              message: "Pixel operation exceeds configured limit.",
              details: { requested: args.pixels.length, maxPixelsPerCall: context.config.maxPixelsPerCall },
            },
          };
        }
        const filePath = context.paths.resolveReadPath(args.filePath);
        const outputPath = args.outputPath ? await context.paths.assertWritable(args.outputPath, args.overwrite) : filePath;
        if (args.dryRun) return { success: true, dryRun: true, filePath, outputPath, pixelCount: args.pixels.length };
        let backupPath: string | undefined;
        if (args.createBackup) backupPath = await createBackup(filePath);
        await ensureParentDirectory(outputPath);
        return context.locks.withFileLock(outputPath, async () => {
          const result = (await context.lua.runOperation("set_pixels", {
            filePath,
            outputPath,
            frameIndex: args.frameIndex,
            layerIndex: args.layerIndex,
            pixels: args.pixels.map((pixel) => ({ ...pixel, color: normalizeColor(pixel.color) })),
          })) as Record<string, unknown>;
          return { ...result, backupPath };
        });
      }),
  );

  server.registerTool(
    "aseprite_fill_region",
    {
      title: "Fill region",
      description: "Fill a rectangular region with one color.",
      inputSchema: { ...RegionSchema, color: ColorSchema },
    },
    async (args) =>
      toolResult(() =>
        runDrawingOperation(context, args, "fill_region", {
          ...args,
          color: normalizeColor(args.color),
        }),
      ),
  );

  server.registerTool(
    "aseprite_clear_region",
    {
      title: "Clear region",
      description: "Clear a rectangular region to transparent pixels.",
      inputSchema: RegionSchema,
    },
    async (args) => toolResult(() => runDrawingOperation(context, args, "clear_region", args)),
  );

  server.registerTool(
    "aseprite_draw_line",
    {
      title: "Draw line",
      description: "Draw a one-pixel Bresenham line on a layer/frame.",
      inputSchema: LineSchema,
    },
    async (args) =>
      toolResult(() =>
        runDrawingOperation(context, args, "draw_line", {
          ...args,
          color: normalizeColor(args.color),
        }),
      ),
  );

  server.registerTool(
    "aseprite_draw_rectangle",
    {
      title: "Draw rectangle",
      description: "Draw an outlined or filled rectangle on a layer/frame.",
      inputSchema: RectangleSchema,
    },
    async (args) =>
      toolResult(() =>
        runDrawingOperation(context, args, "draw_rectangle", {
          ...args,
          color: normalizeColor(args.color),
        }),
      ),
  );
}
