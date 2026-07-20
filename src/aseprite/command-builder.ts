export interface ExportSpritesheetOptions {
  inputPath: string;
  sheetPath: string;
  dataPath?: string;
  sheetType?: "horizontal" | "vertical" | "rows" | "columns" | "packed";
  columns?: number;
  rows?: number;
  scale?: number;
  trim?: boolean;
  mergeDuplicates?: boolean;
  listLayers?: boolean;
  listTags?: boolean;
  listSlices?: boolean;
  filenameFormat?: string;
  format?: "json-array" | "json-hash";
}

export function buildExportPngArgs(inputPath: string, outputPath: string): string[] {
  return ["--batch", inputPath, "--save-as", outputPath];
}

export function buildExportSpritesheetArgs(options: ExportSpritesheetOptions): string[] {
  const args = ["--batch", options.inputPath];
  if (options.scale !== undefined) args.push("--scale", String(options.scale));
  if (options.trim) args.push("--trim");
  if (options.mergeDuplicates) args.push("--merge-duplicates");
  if (options.sheetType) args.push("--sheet-type", options.sheetType);
  if (options.columns !== undefined) args.push("--columns", String(options.columns));
  if (options.rows !== undefined) args.push("--rows", String(options.rows));
  if (options.format) args.push("--format", options.format);
  if (options.listLayers) args.push("--list-layers");
  if (options.listTags) args.push("--list-tags");
  if (options.listSlices) args.push("--list-slices");
  if (options.filenameFormat) args.push("--filename-format", options.filenameFormat);
  args.push("--sheet", options.sheetPath);
  if (options.dataPath) args.push("--data", options.dataPath);
  return args;
}
