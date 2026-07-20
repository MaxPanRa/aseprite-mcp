# aseprite-mcp

MCP server for safe local automation of Aseprite. It exposes a focused set of Model Context Protocol tools that create, inspect, edit, save, and export pixel art documents through the official Aseprite CLI and controlled Lua scripts.

The current implementation is a working MVP for the prompt's Phase 3. It intentionally avoids generic `run_lua`, `execute_command`, or shell tools.

## Requirements

- Node.js 20+
- Aseprite installed locally
- A client that can launch MCP servers over stdio

Official references used for this implementation:

- Aseprite CLI: https://www.aseprite.org/docs/cli/
- Aseprite Lua API: https://www.aseprite.org/api/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- MCP resources spec: https://modelcontextprotocol.io/specification/2025-06-18/server/resources

## Install

```bash
npm install
npm run build
```

## Configure

Copy the example config if you want file-based configuration:

```bash
cp aseprite-mcp.config.example.json aseprite-mcp.config.json
```

On Windows PowerShell:

```powershell
$env:ASEPRITE_PATH = "C:\Program Files\Aseprite\Aseprite.exe"
$env:ASEPRITE_MCP_ALLOWED_DIRECTORIES = "C:\Users\Usuario\Documents\MAX\PROYECTOS"
```

Supported environment variables:

- `ASEPRITE_PATH`
- `ASEPRITE_MCP_ALLOWED_DIRECTORIES`
- `ASEPRITE_MCP_TEMP_DIRECTORY`
- `ASEPRITE_MCP_MAX_WIDTH`
- `ASEPRITE_MCP_MAX_HEIGHT`
- `ASEPRITE_MCP_MAX_FRAMES`
- `ASEPRITE_MCP_PROCESS_TIMEOUT`
- `ASEPRITE_MCP_ALLOW_OVERWRITE`
- `ASEPRITE_MCP_LOG_LEVEL`

## Run

```bash
npm run build
npm start
```

The server uses stdio, so it is meant to be launched by an MCP client.

## Codex MCP Example

See [examples/codex.mcp.json](examples/codex.mcp.json).

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["C:/absolute/path/to/aseprite-mcp/dist/index.js"],
      "env": {
        "ASEPRITE_PATH": "C:/Program Files/Aseprite/Aseprite.exe",
        "ASEPRITE_MCP_ALLOWED_DIRECTORIES": "C:/Users/Usuario/Documents/MAX/PROYECTOS"
      }
    }
  }
}
```

## Claude Desktop Example

See [examples/claude-desktop.mcp.json](examples/claude-desktop.mcp.json).

## Implemented Tools

- `aseprite_create_sprite`
- `aseprite_get_document_info`
- `aseprite_list_layers`
- `aseprite_list_frames`
- `aseprite_set_pixels`
- `aseprite_fill_region`
- `aseprite_clear_region`
- `aseprite_draw_line`
- `aseprite_draw_rectangle`
- `aseprite_create_frame`
- `aseprite_create_tag`
- `aseprite_get_animation_info`
- `aseprite_set_frame_duration`
- `aseprite_set_tag_range`
- `aseprite_set_tag_direction`
- `aseprite_get_palette`
- `aseprite_export_palette`
- `aseprite_create_dual_grid_tileset`
- `aseprite_save_document`
- `aseprite_export_png`
- `aseprite_export_spritesheet`

## Resources

- `aseprite://capabilities`
- `aseprite://config`
- `aseprite://runtime`

## Prompts

- `create-pixel-character`
- `prepare-spritesheet-for-unity`

## Example Calls

Create a 32x32 sprite:

```json
{
  "width": 32,
  "height": 32,
  "colorMode": "rgb",
  "frameCount": 1,
  "frameDurationMs": 100,
  "outputPath": "examples/output/player.aseprite",
  "overwrite": true
}
```

Draw several pixels:

```json
{
  "filePath": "examples/output/player.aseprite",
  "frameIndex": 1,
  "layerIndex": 1,
  "pixels": [
    { "x": 1, "y": 2, "color": "#FF0000FF" },
    { "x": 2, "y": 2, "color": "#00FF00FF" }
  ],
  "createBackup": true
}
```

Create four frames:

```json
{
  "width": 32,
  "height": 32,
  "frameCount": 4,
  "frameDurationMs": 120,
  "outputPath": "examples/output/player.aseprite",
  "overwrite": true
}
```

Create the `idle` tag:

```json
{
  "filePath": "examples/output/player.aseprite",
  "name": "idle",
  "fromFrame": 1,
  "toFrame": 4,
  "direction": "ping-pong"
}
```

Export a spritesheet:

```json
{
  "filePath": "examples/output/player.aseprite",
  "sheetPath": "examples/output/player.png",
  "dataPath": "examples/output/player.json",
  "sheetType": "horizontal",
  "listLayers": true,
  "listTags": true,
  "overwrite": true
}
```

Create a dual-grid tileset:

```json
{
  "outputPath": "examples/output/dual-grid-grass.aseprite",
  "metadataPath": "examples/output/dual-grid-grass.json",
  "tileSize": 16,
  "columns": 4,
  "layoutPreset": "template",
  "referenceStencil": [
    "0000001111000000",
    "0000001111000000",
    "1100001111111111",
    "1100001111111111",
    "1100001111111111",
    "1100001111111111",
    "0011111111111100",
    "0011111111111100",
    "0011111111111100",
    "0011111111111100",
    "0000000000111100",
    "0000000000111100",
    "0000000000111100",
    "0000000000111100",
    "0000111100000000",
    "0000111100000000"
  ],
  "terrainColor": "#49AD52FF",
  "backgroundColor": "#00000000",
  "gridColor": "#FF55D6FF",
  "guideMode": "none",
  "labelMode": "quadrants",
  "requireUniqueTiles": true,
  "overwrite": true
}
```

The default `template` layout follows a dual-grid stencil with 16 unique tile patterns. Material pixels are placed according to a pixel-level template grid, not by row-major binary mask order. `referenceStencil` is optional; when provided, it must be a rectangular `0`/`1` matrix whose width is divisible by `columns` and whose height is divisible by the tileset rows. `requireUniqueTiles` rejects repeated patterns. `labelMode: "quadrants"` overlays `G` for ground and `V` for void in each tile quadrant, useful for debugging the template before art styling. Use `layoutPreset: "bitmask"` only when you need the direct `NW=1`, `NE=2`, `SE=4`, `SW=8` quadrant map. The metadata file includes tile rectangles, per-tile stencil patterns, pattern resolution, and quadrant summaries for engine-side lookup.

Query the palette:

Use `aseprite_get_document_info`; the `document.palette` array contains palette entries.

Generate a preview:

Use `aseprite_export_png`:

```json
{
  "filePath": "examples/output/player.aseprite",
  "outputPath": "examples/output/player-preview.png",
  "overwrite": true
}
```

Modify an existing file safely:

```json
{
  "filePath": "examples/output/player.aseprite",
  "outputPath": "examples/output/player-edited.aseprite",
  "pixels": [
    { "x": 10, "y": 10, "color": { "r": 255, "g": 255, "b": 255, "a": 255 } }
  ],
  "createBackup": true,
  "overwrite": true
}
```

## Security Model

- All paths are resolved against the server working directory.
- Reads and writes are restricted to configured allowed directories.
- Path traversal and unsupported extensions are rejected.
- Aseprite is launched with argument arrays, not shell command strings.
- Lua is generated by the server and selected by operation name.
- Clients cannot send arbitrary Lua or shell commands.
- Writes can require explicit `overwrite`.
- Destructive operations can create backups.
- Per-file locks serialize writes to the same destination.
- Processes have timeouts and output size limits.

## Tests

```bash
npm run build
npm test
```

Current verified result:

- TypeScript build passes.
- 5 test files pass.
- 11 tests pass.

The integration smoke test checks discovery without requiring Aseprite. Full real-file tests require `ASEPRITE_PATH`.

## Known Aseprite Limitations

- CLI export is strong for conversion and spritesheets, but many document edits require Lua.
- `--sheet` overwrites output files, so this server validates overwrite before invoking it.
- Some Lua standard library operations can be permission-sensitive in Aseprite; this MVP avoids client-supplied Lua and passes operation payload through script parameters.
- Spritesheet export options are limited to documented CLI flags currently wired in `command-builder.ts`.
- Additional tileset systems, region transforms, palette mutation tools, and high-level deterministic generators are not implemented yet.

## Pending Tools

Next priority groups:

- Sequence duplication and animation preview export
- Palette mutation/import
- Region ellipse/flood-fill/move/flip/rotate
- Additional tileset creation systems and metadata
- High-level deterministic templates for 16/32px characters, enemies, objects, and UI

## Complete Animation Flow

See [examples/create-animation.json](examples/create-animation.json) for a complete sequence:

1. Create a 32x32 four-frame document.
2. Draw a compact set of pixels.
3. Create an `idle` ping-pong tag.
4. Export a horizontal spritesheet and JSON metadata.
