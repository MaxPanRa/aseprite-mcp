import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "create-pixel-character",
    {
      title: "Create a pixel character",
      description: "Plan deterministic MCP calls for creating a small character sprite.",
      argsSchema: {
        filePath: z.string().describe("Output .aseprite path."),
        size: z.string().default("32x32").describe("Sprite size, for example 32x32."),
      },
    },
    ({ filePath, size }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a ${size} pixel art character at ${filePath}. Use aseprite_create_sprite, aseprite_set_pixels with compact batches, create idle frames, tag them, and export a PNG preview.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "prepare-spritesheet-for-unity",
    {
      title: "Prepare spritesheet for Unity",
      description: "Export packed spritesheet metadata suitable for Unity import.",
      argsSchema: {
        filePath: z.string(),
        sheetPath: z.string(),
        dataPath: z.string(),
      },
    },
    ({ filePath, sheetPath, dataPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Inspect ${filePath}, validate tags and frame durations, then export a packed spritesheet to ${sheetPath} with JSON metadata at ${dataPath}.`,
          },
        },
      ],
    }),
  );
}
