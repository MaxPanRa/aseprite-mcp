import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext } from "../context.js";
import { registerDocumentTools } from "./document/index.js";
import { registerDrawingTools } from "./drawing/index.js";
import { registerExportTools } from "./export/index.js";
import { registerAnimationTools } from "./animation/index.js";
import { registerPaletteTools } from "./palette/index.js";
import { registerTilesetTools } from "./tileset/index.js";

export function registerTools(server: McpServer, context: AppContext): void {
  registerDocumentTools(server, context);
  registerDrawingTools(server, context);
  registerAnimationTools(server, context);
  registerPaletteTools(server, context);
  registerTilesetTools(server, context);
  registerExportTools(server, context);
}
