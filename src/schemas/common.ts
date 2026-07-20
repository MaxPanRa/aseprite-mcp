import { z } from "zod";
import { ColorSchema } from "../utils/color.js";

export const FilePathSchema = z.string().min(1).max(1024);

export const OperationOptionsSchema = z.object({
  overwrite: z.boolean().optional(),
  createBackup: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  saveAfterOperation: z.boolean().default(true),
});

export const PixelSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  color: ColorSchema,
});

export const SpriteColorModeSchema = z.enum(["rgb", "indexed", "grayscale"]);

export const TagDirectionSchema = z.enum(["forward", "reverse", "ping-pong", "ping-pong-reverse"]);
