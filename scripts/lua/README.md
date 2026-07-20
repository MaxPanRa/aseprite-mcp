# Lua runner

The MVP uses one generated Lua runner embedded in [src/aseprite/lua-runner.ts](../../src/aseprite/lua-runner.ts).

At runtime the server writes that controlled runner to the configured temp directory, passes a base64 JSON payload through `--script-param payload=...`, executes it with Aseprite `--batch --script`, and removes the temporary script afterward.

This keeps the MCP surface restricted to named operations instead of exposing arbitrary Lua execution.
