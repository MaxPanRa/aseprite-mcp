import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema, OperationOptionsSchema, TagDirectionSchema } from "../../schemas/common.js";
import { createBackup, ensureParentDirectory } from "../../utils/file.js";
import { toolResult } from "../tool-result.js";

const CreateFrameSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameNumber: z.number().int().min(1).optional(),
  copyFromFrame: z.number().int().min(1).optional(),
  durationMs: z.number().int().min(1).optional(),
  ...OperationOptionsSchema.shape,
};

const CreateTagSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  name: z.string().min(1).max(128),
  fromFrame: z.number().int().min(1),
  toFrame: z.number().int().min(1),
  direction: TagDirectionSchema.default("forward"),
  repeats: z.number().int().min(0).optional(),
  ...OperationOptionsSchema.shape,
};

const AnimationInfoSchema = {
  filePath: FilePathSchema,
  tagName: z.string().min(1).max(128).optional(),
};

const SetFrameDurationSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  frameNumber: z.number().int().min(1),
  durationMs: z.number().int().min(1),
  ...OperationOptionsSchema.shape,
};

const SetTagRangeSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  name: z.string().min(1).max(128),
  fromFrame: z.number().int().min(1),
  toFrame: z.number().int().min(1),
  ...OperationOptionsSchema.shape,
};

const SetTagDirectionSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema.optional(),
  name: z.string().min(1).max(128),
  direction: TagDirectionSchema,
  ...OperationOptionsSchema.shape,
};

async function runAnimationOperation(
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

export function registerAnimationTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_create_frame",
    {
      title: "Create frame",
      description: "Create an empty frame or duplicate an existing frame.",
      inputSchema: CreateFrameSchema,
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
          const result = (await context.lua.runOperation("create_frame", { ...args, filePath, outputPath })) as Record<string, unknown>;
          return { ...result, backupPath };
        });
      }),
  );

  server.registerTool(
    "aseprite_create_tag",
    {
      title: "Create tag",
      description: "Create an animation tag with a verified Aseprite animation direction.",
      inputSchema: CreateTagSchema,
    },
    async (args) =>
      toolResult(async () => {
        if (args.toFrame < args.fromFrame) {
          return {
            success: false,
            error: {
              code: "INVALID_TAG_RANGE",
              message: "toFrame must be greater than or equal to fromFrame.",
              details: { fromFrame: args.fromFrame, toFrame: args.toFrame },
            },
          };
        }
        const filePath = context.paths.resolveReadPath(args.filePath);
        const outputPath = args.outputPath ? await context.paths.assertWritable(args.outputPath, args.overwrite) : filePath;
        if (args.dryRun) return { success: true, dryRun: true, filePath, outputPath };
        let backupPath: string | undefined;
        if (args.createBackup) backupPath = await createBackup(filePath);
        await ensureParentDirectory(outputPath);
        return context.locks.withFileLock(outputPath, async () => {
          const result = (await context.lua.runOperation("create_tag", { ...args, filePath, outputPath })) as Record<string, unknown>;
          return { ...result, backupPath };
        });
      }),
  );

  server.registerTool(
    "aseprite_get_animation_info",
    {
      title: "Get animation info",
      description: "Return tag, frame range, direction, and frame-duration information for animations.",
      inputSchema: AnimationInfoSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        return context.lua.runOperation("animation_info", { filePath, tagName: args.tagName });
      }),
  );

  server.registerTool(
    "aseprite_set_frame_duration",
    {
      title: "Set frame duration",
      description: "Set one frame's duration in milliseconds.",
      inputSchema: SetFrameDurationSchema,
    },
    async (args) =>
      toolResult(() =>
        runAnimationOperation(context, args, "set_frame_duration", {
          frameNumber: args.frameNumber,
          durationMs: args.durationMs,
        }),
      ),
  );

  server.registerTool(
    "aseprite_set_tag_range",
    {
      title: "Set tag range",
      description: "Move an existing animation tag to a new frame range.",
      inputSchema: SetTagRangeSchema,
    },
    async (args) =>
      toolResult(() => {
        if (args.toFrame < args.fromFrame) {
          return Promise.resolve({
            success: false,
            error: {
              code: "INVALID_TAG_RANGE",
              message: "toFrame must be greater than or equal to fromFrame.",
              details: { fromFrame: args.fromFrame, toFrame: args.toFrame },
            },
          });
        }
        return runAnimationOperation(context, args, "set_tag_range", {
          name: args.name,
          fromFrame: args.fromFrame,
          toFrame: args.toFrame,
        });
      }),
  );

  server.registerTool(
    "aseprite_set_tag_direction",
    {
      title: "Set tag direction",
      description: "Set an existing animation tag direction.",
      inputSchema: SetTagDirectionSchema,
    },
    async (args) =>
      toolResult(() =>
        runAnimationOperation(context, args, "set_tag_direction", {
          name: args.name,
          direction: args.direction,
        }),
      ),
  );
}
