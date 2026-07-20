import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "./context.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

export async function createAsepriteMcpServer(): Promise<McpServer> {
  const context = await createContext();
  const server = new McpServer(
    {
      name: "aseprite-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        prompts: {},
        tools: {},
      },
    },
  );

  registerTools(server, context);
  registerResources(server, context);
  registerPrompts(server);
  return server;
}
