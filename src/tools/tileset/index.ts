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
  layoutPreset: z.enum(["template", "bitmask"]).default("template"),
  terrainColor: ColorSchema.default("#49AD52FF"),
  backgroundColor: ColorSchema.default("#00000000"),
  edgeColor: ColorSchema.default("#2F5F2AFF"),
  highlightColor: ColorSchema.default("#78C850FF"),
  shadowColor: ColorSchema.default("#1F3F1FFF"),
  gridColor: ColorSchema.default("#FF55D6FF"),
  guideMode: z.enum(["none", "tile", "quadrant"]).default("none"),
  labelMode: z.enum(["none", "mask"]).default("none"),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

const REFERENCE_DUAL_GRID_TEMPLATE = [
  "00011000",
  "10011111",
  "10011111",
  "01111110",
  "01111110",
  "00000110",
  "00000110",
  "00110000",
] as const;

function tilePatternFromTemplate(mask: number, columns: number): [string, string] {
  const column = mask % columns;
  const row = Math.floor(mask / columns);
  const x = column * 2;
  const y = row * 2;
  return [
    REFERENCE_DUAL_GRID_TEMPLATE[y]?.slice(x, x + 2) ?? "00",
    REFERENCE_DUAL_GRID_TEMPLATE[y + 1]?.slice(x, x + 2) ?? "00",
  ];
}

function tilePatternFromMask(mask: number): [string, string] {
  return [
    `${mask & 1 ? "1" : "0"}${mask & 2 ? "1" : "0"}`,
    `${mask & 8 ? "1" : "0"}${mask & 4 ? "1" : "0"}`,
  ];
}

function dualGridTiles(
  tileSize: 16 | 32,
  columns: number,
  spacing: number,
  margin: number,
  layoutPreset: "template" | "bitmask",
) {
  return Array.from({ length: 16 }, (_, mask) => {
    const column = mask % columns;
    const row = Math.floor(mask / columns);
    const pattern = layoutPreset === "template" ? tilePatternFromTemplate(mask, columns) : tilePatternFromMask(mask);
    return {
      mask,
      name: `dual-grid-${mask.toString(2).padStart(4, "0")}`,
      pattern,
      bits: {
        nw: pattern[0][0] === "1",
        ne: pattern[0][1] === "1",
        sw: pattern[1][0] === "1",
        se: pattern[1][1] === "1",
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
        const tiles = dualGridTiles(args.tileSize, args.columns, args.spacing, args.margin, args.layoutPreset);
        const metadata = {
          type: "dual-grid",
          version: 1,
          outputPath,
          tileSize: args.tileSize,
          columns: args.columns,
          rows,
          spacing: args.spacing,
          margin: args.margin,
          layoutPreset: args.layoutPreset,
          referenceTemplate: args.layoutPreset === "template" ? REFERENCE_DUAL_GRID_TEMPLATE : undefined,
          guideMode: args.guideMode,
          bitOrder: args.layoutPreset === "bitmask" ? { nw: 1, ne: 2, se: 4, sw: 8 } : undefined,
          maskFormula:
            args.layoutPreset === "bitmask"
              ? "mask = (nw ? 1 : 0) | (ne ? 2 : 0) | (se ? 4 : 0) | (sw ? 8 : 0)"
              : "pattern is copied from the reference dual-grid template stencil",
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
          tilePatterns: tiles.map((tile) => tile.pattern),
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
