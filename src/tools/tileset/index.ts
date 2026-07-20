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
  referenceStencil: z.array(z.string().regex(/^[01]+$/)).optional(),
  terrainColor: ColorSchema.default("#49AD52FF"),
  backgroundColor: ColorSchema.default("#00000000"),
  edgeColor: ColorSchema.default("#2F5F2AFF"),
  highlightColor: ColorSchema.default("#78C850FF"),
  shadowColor: ColorSchema.default("#1F3F1FFF"),
  gridColor: ColorSchema.default("#FF55D6FF"),
  guideMode: z.enum(["none", "tile", "quadrant"]).default("none"),
  labelMode: z.enum(["none", "mask", "quadrants"]).default("none"),
  requireUniqueTiles: z.boolean().default(true),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

function buildUniqueDualGridStencil(columns = 4, rows = 4, quadrantCells = 2): string[] {
  return Array.from({ length: rows * quadrantCells * 2 }, (_, y) => {
    const tileRow = Math.floor(y / (quadrantCells * 2));
    const localY = y % (quadrantCells * 2);
    const south = localY >= quadrantCells;
    let line = "";
    for (let tileColumn = 0; tileColumn < columns; tileColumn += 1) {
      const mask = tileRow * columns + tileColumn;
      for (let localX = 0; localX < quadrantCells * 2; localX += 1) {
        const east = localX >= quadrantCells;
        const bit = !south && !east ? 1 : !south && east ? 2 : south && east ? 4 : 8;
        line += mask & bit ? "1" : "0";
      }
    }
    return line;
  });
}

const REFERENCE_DUAL_GRID_PIXEL_STENCIL = buildUniqueDualGridStencil();

function tilePatternFromTemplate(mask: number, columns: number, rows: number, referenceStencil: readonly string[]): string[] {
  const column = mask % columns;
  const row = Math.floor(mask / columns);
  const tileStencilWidth = Math.floor((referenceStencil[0]?.length ?? 0) / columns);
  const tileStencilHeight = Math.floor(referenceStencil.length / rows);
  const x = column * tileStencilWidth;
  const y = row * tileStencilHeight;
  return Array.from({ length: tileStencilHeight }, (_, offset) =>
    referenceStencil[y + offset]?.slice(x, x + tileStencilWidth) ?? "0".repeat(tileStencilWidth),
  );
}

function tilePatternFromMask(mask: number): string[] {
  return [
    `${mask & 1 ? "1" : "0"}${mask & 2 ? "1" : "0"}`,
    `${mask & 8 ? "1" : "0"}${mask & 4 ? "1" : "0"}`,
  ];
}

function quadrantHasGround(pattern: string[], quadrant: "nw" | "ne" | "sw" | "se"): boolean {
  const rowStart = quadrant === "nw" || quadrant === "ne" ? 0 : Math.floor(pattern.length / 2);
  const rowEnd = quadrant === "nw" || quadrant === "ne" ? Math.ceil(pattern.length / 2) : pattern.length;
  const columnStart = quadrant === "nw" || quadrant === "sw" ? 0 : Math.floor((pattern[0]?.length ?? 0) / 2);
  const columnEnd = quadrant === "nw" || quadrant === "sw" ? Math.ceil((pattern[0]?.length ?? 0) / 2) : (pattern[0]?.length ?? 0);

  for (let y = rowStart; y < rowEnd; y += 1) {
    for (let x = columnStart; x < columnEnd; x += 1) {
      if (pattern[y]?.[x] === "1") return true;
    }
  }
  return false;
}

function groundCellCount(pattern: string[]): number {
  return pattern.reduce((sum, row) => sum + Array.from(row).filter((cell) => cell === "1").length, 0);
}

function dualGridTiles(
  tileSize: 16 | 32,
  columns: number,
  rows: number,
  spacing: number,
  margin: number,
  layoutPreset: "template" | "bitmask",
  referenceStencil: readonly string[],
) {
  return Array.from({ length: 16 }, (_, mask) => {
    const column = mask % columns;
    const row = Math.floor(mask / columns);
    const pattern =
      layoutPreset === "template" ? tilePatternFromTemplate(mask, columns, rows, referenceStencil) : tilePatternFromMask(mask);
    return {
      mask,
      name: `dual-grid-${mask.toString(2).padStart(4, "0")}`,
      pattern,
      patternResolution: { width: pattern[0]?.length ?? 0, height: pattern.length },
      groundCells: groundCellCount(pattern),
      bits: {
        nw: quadrantHasGround(pattern, "nw"),
        ne: quadrantHasGround(pattern, "ne"),
        sw: quadrantHasGround(pattern, "sw"),
        se: quadrantHasGround(pattern, "se"),
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

function validateReferenceStencil(referenceStencil: string[], columns: number, rows: number) {
  if (referenceStencil.length === 0) {
    return { code: "INVALID_REFERENCE_STENCIL", message: "referenceStencil cannot be empty." };
  }
  const width = referenceStencil[0]?.length ?? 0;
  if (width === 0) {
    return { code: "INVALID_REFERENCE_STENCIL", message: "referenceStencil rows cannot be empty." };
  }
  if (!referenceStencil.every((row) => row.length === width)) {
    return { code: "INVALID_REFERENCE_STENCIL", message: "All referenceStencil rows must have the same width." };
  }
  if (width % columns !== 0 || referenceStencil.length % rows !== 0) {
    return {
      code: "INVALID_REFERENCE_STENCIL",
      message: "referenceStencil dimensions must be divisible by the tileset columns and rows.",
      details: { stencilWidth: width, stencilHeight: referenceStencil.length, columns, rows },
    };
  }
  return undefined;
}

function duplicatePatterns(tiles: ReturnType<typeof dualGridTiles>) {
  const seen = new Map<string, number>();
  const duplicates: Array<{ firstMask: number; duplicateMask: number; pattern: string[] }> = [];
  for (const tile of tiles) {
    const key = tile.pattern.join("\n");
    const firstMask = seen.get(key);
    if (firstMask === undefined) {
      seen.set(key, tile.mask);
    } else {
      duplicates.push({ firstMask, duplicateMask: tile.mask, pattern: tile.pattern });
    }
  }
  return duplicates;
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
        const referenceStencil = args.referenceStencil ?? [...REFERENCE_DUAL_GRID_PIXEL_STENCIL];
        if (args.layoutPreset === "template") {
          const validationError = validateReferenceStencil(referenceStencil, args.columns, rows);
          if (validationError) {
            return {
              success: false,
              error: validationError,
            };
          }
        }
        const tiles = dualGridTiles(
          args.tileSize,
          args.columns,
          rows,
          args.spacing,
          args.margin,
          args.layoutPreset,
          referenceStencil,
        );
        const duplicates = duplicatePatterns(tiles);
        if (args.requireUniqueTiles && duplicates.length > 0) {
          return {
            success: false,
            error: {
              code: "DUPLICATE_TILE_PATTERNS",
              message: "Dual-grid tileset contains repeated tile patterns.",
              details: { duplicates },
            },
          };
        }
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
          referencePixelStencil: args.layoutPreset === "template" ? referenceStencil : undefined,
          guideMode: args.guideMode,
          bitOrder: args.layoutPreset === "bitmask" ? { nw: 1, ne: 2, se: 4, sw: 8 } : undefined,
          maskFormula:
            args.layoutPreset === "bitmask"
              ? "mask = (nw ? 1 : 0) | (ne ? 2 : 0) | (se ? 4 : 0) | (sw ? 8 : 0)"
              : "pattern is copied from the reference dual-grid template stencil",
          duplicatePatterns: duplicates,
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
