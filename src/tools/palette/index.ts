import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { FilePathSchema } from "../../schemas/common.js";
import { ensureParentDirectory } from "../../utils/file.js";
import { rgbaToHex, type Rgba } from "../../utils/color.js";
import { toolResult } from "../tool-result.js";

const GetPaletteSchema = {
  filePath: FilePathSchema,
};

const ExportPaletteSchema = {
  filePath: FilePathSchema,
  outputPath: FilePathSchema,
  format: z.enum(["json", "gpl"]).default("json"),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().default(false),
};

interface PaletteEntry extends Rgba {
  index: number;
}

interface DocumentInfoResult {
  document?: {
    palette?: PaletteEntry[];
  };
}

function paletteToGpl(entries: PaletteEntry[], name: string): string {
  const lines = ["GIMP Palette", `Name: ${name}`, "Columns: 8", "#"];
  for (const entry of entries) {
    lines.push(`${entry.r} ${entry.g} ${entry.b}\t${rgbaToHex(entry)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function registerPaletteTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "aseprite_get_palette",
    {
      title: "Get palette",
      description: "Return the first document palette as structured RGBA entries.",
      inputSchema: GetPaletteSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const result = (await context.lua.runOperation("document_info", { filePath })) as DocumentInfoResult;
        return { success: true, filePath, palette: result.document?.palette ?? [] };
      }),
  );

  server.registerTool(
    "aseprite_export_palette",
    {
      title: "Export palette",
      description: "Export the first document palette to JSON or GIMP GPL format.",
      inputSchema: ExportPaletteSchema,
    },
    async (args) =>
      toolResult(async () => {
        const filePath = context.paths.resolveReadPath(args.filePath);
        const outputPath = await context.paths.assertWritable(args.outputPath, args.overwrite);
        const result = (await context.lua.runOperation("document_info", { filePath })) as DocumentInfoResult;
        const palette = result.document?.palette ?? [];
        if (args.dryRun) return { success: true, dryRun: true, filePath, outputPath, format: args.format, colorCount: palette.length };
        await ensureParentDirectory(outputPath);
        const content =
          args.format === "json"
            ? `${JSON.stringify({ filePath, palette }, null, 2)}\n`
            : paletteToGpl(palette, "aseprite-mcp-export");
        await fs.writeFile(outputPath, content, "utf8");
        return { success: true, filePath, outputPath, format: args.format, colorCount: palette.length };
      }),
  );
}
