import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema } from "../../schemas/common.js";
import { ColorSchema, normalizeColor } from "../../utils/color.js";
import { ensureParentDirectory } from "../../utils/file.js";
import { toolResult } from "../tool-result.js";

const DualGridTilesetSchema = {
  outputPath: FilePathSchema,
  metadataPath: FilePathSchema.optional(),
  tileSize: z.union([z.literal(16), z.literal(32)]).default(16),
  columns: z.number().int().min(1).max(16).default(4),
  spacing: z.number().int().min(0).max(8).default(0),
  margin: z.number().int().min(0).max(16).default(0),
  terrainColor: ColorSchema.default("#FF4058FF"),
  backgroundColor: ColorSchema.default("#FFFFFFFF"),
  edgeColor: ColorSchema.default("#2F5F2AFF"),
  highlightColor: ColorSchema.default("#78C850FF"),
  shadowColor: ColorSchema.default("#1F3F1FFF"),
  gridColor: ColorSchema.default("#FF55D6FF"),
  guideMode: z.enum(["none", "tile", "quadrant"]).default("quadrant"),
  labelMode: z.enum(["none", "mask"]).default("none"),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

const CORNERS = [
  { key: "nw", bit: 1 },
  { key: "ne", bit: 2 },
  { key: "se", bit: 4 },
  { key: "sw", bit: 8 },
] as const;

function dualGridTiles(tileSize: 16 | 32, columns: number, spacing: number, margin: number) {
  return Array.from({ length: 16 }, (_, mask) => {
    const column = mask % columns;
    const row = Math.floor(mask / columns);
    return {
      mask,
      name: `dual-grid-${mask.toString(2).padStart(4, "0")}`,
      bits: {
        nw: Boolean(mask & 1),
        ne: Boolean(mask & 2),
        se: Boolean(mask & 4),
        sw: Boolean(mask & 8),
      },
      sourceRect: {
        x: margin + column * (tileSize + spacing),
        y: margin + row * (tileSize + spacing),
        width: tileSize,
        height: tileSize,
      },
    };
  });
}

export function registerTilesetTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_create_dual_grid_tileset",
    {
      title: "Create dual-grid tileset",
      description:
        "Create a 16-tile dual-grid terrain tileset where each tile maps to a 4-bit corner mask: NW=1, NE=2, SE=4, SW=8.",
      inputSchema: DualGridTilesetSchema,
    },
    async (args) =>
      toolResult(async () => {
        const rows = Math.ceil(16 / args.columns);
        const width = args.margin * 2 + args.columns * args.tileSize + (args.columns - 1) * args.spacing;
        const height = args.margin * 2 + rows * args.tileSize + (rows - 1) * args.spacing;
        if (width > context.config.maxWidth || height > context.config.maxHeight) {
          return {
            success: false,
            error: {
              code: "CANVAS_TOO_LARGE",
              message: "Dual-grid tileset dimensions exceed configured limits.",
              details: { width, height, maxWidth: context.config.maxWidth, maxHeight: context.config.maxHeight },
            },
          };
        }

        const outputPath = await context.paths.assertWritable(args.outputPath, args.overwrite);
        const metadataPath = args.metadataPath
          ? await context.paths.assertWritable(args.metadataPath, args.overwrite)
          : undefined;
        const tiles = dualGridTiles(args.tileSize, args.columns, args.spacing, args.margin);
        const metadata = {
          type: "dual-grid",
          version: 1,
          outputPath,
          tileSize: args.tileSize,
          columns: args.columns,
          rows,
          spacing: args.spacing,
          margin: args.margin,
          guideMode: args.guideMode,
          bitOrder: { nw: 1, ne: 2, se: 4, sw: 8 },
          maskFormula: "mask = (nw ? 1 : 0) | (ne ? 2 : 0) | (se ? 4 : 0) | (sw ? 8 : 0)",
          tiles,
        };

        if (args.dryRun) {
          return { success: true, dryRun: true, outputPath, metadataPath, width, height, tiles };
        }

        await ensureParentDirectory(outputPath);
        if (metadataPath) await ensureParentDirectory(metadataPath);
        const result = (await context.lua.runOperation("create_dual_grid_tileset", {
          outputPath,
          tileSize: args.tileSize,
          columns: args.columns,
          spacing: args.spacing,
          margin: args.margin,
          terrainColor: normalizeColor(args.terrainColor),
          backgroundColor: normalizeColor(args.backgroundColor),
          edgeColor: normalizeColor(args.edgeColor),
          highlightColor: normalizeColor(args.highlightColor),
          shadowColor: normalizeColor(args.shadowColor),
          gridColor: normalizeColor(args.gridColor),
          guideMode: args.guideMode,
          labelMode: args.labelMode,
        })) as Record<string, unknown>;

        if (metadataPath) {
          await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
        }

        return { ...result, metadataPath, metadata };
      }),
  );
}
