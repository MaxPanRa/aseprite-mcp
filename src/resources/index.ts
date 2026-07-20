import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext } from "../context.js";

function textResource(uri: URL, value: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function registerResources(server: McpServer, context: AppContext): void {
  server.registerResource(
    "aseprite-capabilities",
    "aseprite://capabilities",
    {
      title: "Aseprite MCP capabilities",
      description: "Lists implemented tools and planned tool families.",
      mimeType: "application/json",
    },
    (uri) =>
      textResource(uri, {
        implementedTools: [
          "aseprite_create_sprite",
          "aseprite_get_document_info",
          "aseprite_list_layers",
          "aseprite_list_frames",
          "aseprite_set_pixels",
          "aseprite_fill_region",
          "aseprite_clear_region",
          "aseprite_draw_line",
          "aseprite_draw_rectangle",
          "aseprite_create_frame",
          "aseprite_create_tag",
          "aseprite_get_animation_info",
          "aseprite_set_frame_duration",
          "aseprite_set_tag_range",
          "aseprite_set_tag_direction",
          "aseprite_get_palette",
          "aseprite_export_palette",
          "aseprite_create_dual_grid_tileset",
          "aseprite_save_document",
          "aseprite_export_png",
          "aseprite_export_spritesheet",
        ],
        pendingFamilies: [
          "palette mutation/import",
          "additional tileset systems",
          "character/enemy/object/UI deterministic generators",
          "advanced region transforms",
        ],
        transport: "stdio",
      }),
  );

  server.registerResource(
    "aseprite-config",
    "aseprite://config",
    {
      title: "Aseprite MCP configuration",
      description: "Runtime configuration without secrets.",
      mimeType: "application/json",
    },
    (uri) =>
      textResource(uri, {
        allowedDirectories: context.paths.allowedDirectories,
        tempDirectory: context.paths.tempDirectory,
        maxWidth: context.config.maxWidth,
        maxHeight: context.config.maxHeight,
        maxFrames: context.config.maxFrames,
        maxPixelsPerCall: context.config.maxPixelsPerCall,
        processTimeoutMs: context.config.processTimeoutMs,
        allowOverwrite: context.config.allowOverwrite,
      }),
  );

  server.registerResource(
    "aseprite-runtime",
    "aseprite://runtime",
    {
      title: "Aseprite runtime",
      description: "Detected Aseprite executable and version.",
      mimeType: "application/json",
    },
    async (uri) => textResource(uri, await context.discovery.detect()),
  );
}
