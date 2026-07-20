import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { AppConfig } from "../config/config.js";
import type { AsepriteCli } from "./cli.js";
import { McpError } from "../utils/errors.js";

const RESULT_PREFIX = "ASEPRITE_MCP_RESULT:";

export class LuaRunner {
  constructor(
    private readonly config: AppConfig,
    private readonly cli: AsepriteCli,
  ) {}

  async runOperation(operation: string, payload: Record<string, unknown>): Promise<unknown> {
    const tempDirectory = path.resolve(this.config.rootDirectory, this.config.tempDirectory);
    await fs.mkdir(tempDirectory, { recursive: true });
    const scriptPath = path.join(tempDirectory, `aseprite-mcp-${crypto.randomUUID()}.lua`);
    await fs.writeFile(scriptPath, LUA_RUNNER, "utf8");
    try {
      const encodedPayload = Buffer.from(JSON.stringify({ operation, payload }), "utf8").toString("base64");
      const result = await this.cli.run(["--batch", "--script-param", `payload=${encodedPayload}`, "--script", scriptPath]);
      const line = result.stdout
        .split(/\r?\n/)
        .find((entry) => entry.startsWith(RESULT_PREFIX));
      if (!line) {
        throw new McpError("LUA_RESULT_MISSING", "Aseprite script did not return structured output.", {
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }
      const parsed = JSON.parse(line.slice(RESULT_PREFIX.length));
      if (parsed && typeof parsed === "object" && "success" in parsed && parsed.success === false) {
        throw new McpError(
          String(parsed.error?.code ?? "LUA_OPERATION_FAILED"),
          String(parsed.error?.message ?? "Lua operation failed."),
          (parsed.error?.details ?? {}) as Record<string, unknown>,
        );
      }
      return parsed;
    } finally {
      await fs.rm(scriptPath, { force: true });
    }
  }
}

const LUA_RUNNER = String.raw`
local function fail(code, message, details)
  print("ASEPRITE_MCP_RESULT:" .. json.encode({ success=false, error={ code=code, message=message, details=details or {} } }))
end

local function ok(result)
  result.success = true
  print("ASEPRITE_MCP_RESULT:" .. json.encode(result))
end

local function decode_base64(data)
  local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  data = string.gsub(data, '[^'..b..'=]', '')
  return (data:gsub('.', function(x)
    if (x == '=') then return '' end
    local r,f='',(b:find(x)-1)
    for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
    return r;
  end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
    if (#x ~= 8) then return '' end
    local c=0
    for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
    return string.char(c)
  end))
end

local function color_mode(value)
  if value == "rgb" then return ColorMode.RGB end
  if value == "indexed" then return ColorMode.INDEXED end
  if value == "grayscale" then return ColorMode.GRAY end
  return ColorMode.RGB
end

local function ani_dir(value)
  if value == "reverse" then return AniDir.REVERSE end
  if value == "ping-pong" then return AniDir.PING_PONG end
  if value == "ping-pong-reverse" then return AniDir.PING_PONG_REVERSE end
  return AniDir.FORWARD
end

local function ani_dir_name(value)
  if value == AniDir.REVERSE then return "reverse" end
  if value == AniDir.PING_PONG then return "ping-pong" end
  if value == AniDir.PING_PONG_REVERSE then return "ping-pong-reverse" end
  return "forward"
end

local function open_sprite(file_path)
  local sprite = Sprite{ fromFile=file_path }
  if sprite == nil then error("Could not open sprite: " .. file_path) end
  return sprite
end

local function frame_index(frame)
  if frame == nil then return nil end
  return frame.frameNumber
end

local function layer_info(layer, index)
  return {
    index=index,
    name=layer.name,
    isVisible=layer.isVisible,
    isEditable=layer.isEditable,
    opacity=layer.opacity,
    blendMode=tostring(layer.blendMode),
    isGroup=layer.isGroup,
    isImage=layer.isImage,
    isTilemap=layer.isTilemap
  }
end

local function sprite_info(sprite)
  local layers = {}
  for i, layer in ipairs(sprite.layers) do layers[#layers+1] = layer_info(layer, i) end
  local frames = {}
  for i, frame in ipairs(sprite.frames) do frames[#frames+1] = { index=i, frameNumber=frame.frameNumber, duration=frame.duration } end
  local tags = {}
  for i, tag in ipairs(sprite.tags) do
    tags[#tags+1] = { index=i, name=tag.name, fromFrame=frame_index(tag.fromFrame), toFrame=frame_index(tag.toFrame), frames=tag.frames, direction=ani_dir_name(tag.aniDir), repeats=tag.repeats }
  end
  local slices = {}
  for i, slice in ipairs(sprite.slices) do slices[#slices+1] = { index=i, name=slice.name } end
  local palette = {}
  if sprite.palettes and sprite.palettes[1] then
    local p = sprite.palettes[1]
    for i=0,#p-1 do
      local c = p:getColor(i)
      palette[#palette+1] = { index=i, r=c.red, g=c.green, b=c.blue, a=c.alpha }
    end
  end
  return {
    width=sprite.width,
    height=sprite.height,
    colorMode=tostring(sprite.colorMode),
    filename=sprite.filename,
    frames=frames,
    layers=layers,
    tags=tags,
    slices=slices,
    palette=palette,
    transparentColor=sprite.transparentColor,
    isModified=sprite.isModified
  }
end

local function default_layer(sprite)
  if #sprite.layers == 0 then return sprite:newLayer() end
  return sprite.layers[1]
end

local function editable_cel(sprite, layer_index, frame_index_arg)
  local layer = sprite.layers[layer_index or 1] or default_layer(sprite)
  local frame_number = frame_index_arg or 1
  local cel = layer:cel(frame_number)
  if cel == nil then cel = sprite:newCel(layer, frame_number) end
  return cel, layer, frame_number
end

local function set_pixel(sprite, layer_index, frame_index_arg, pixel)
  local cel = editable_cel(sprite, layer_index, frame_index_arg)
  local image = cel.image
  local color = app.pixelColor.rgba(pixel.color.r, pixel.color.g, pixel.color.b, pixel.color.a)
  image:drawPixel(pixel.x, pixel.y, color)
end

local function draw_point(sprite, layer_index, frame_index_arg, x, y, color_payload)
  if x < 0 or y < 0 or x >= sprite.width or y >= sprite.height then return false end
  local cel = editable_cel(sprite, layer_index, frame_index_arg)
  local color = app.pixelColor.rgba(color_payload.r, color_payload.g, color_payload.b, color_payload.a)
  cel.image:drawPixel(x, y, color)
  return true
end

local function clear_point(sprite, layer_index, frame_index_arg, x, y)
  if x < 0 or y < 0 or x >= sprite.width or y >= sprite.height then return false end
  local cel = editable_cel(sprite, layer_index, frame_index_arg)
  cel.image:drawPixel(x, y, 0)
  return true
end

local function find_tag(sprite, name)
  for _, tag in ipairs(sprite.tags) do
    if tag.name == name then return tag end
  end
  return nil
end

local function animation_info(sprite, tag_name)
  local tags = {}
  for i, tag in ipairs(sprite.tags) do
    if tag_name == nil or tag.name == tag_name then
      local frames = {}
      for frame_number = tag.fromFrame.frameNumber, tag.toFrame.frameNumber do
        local frame = sprite.frames[frame_number]
        frames[#frames+1] = { index=frame_number, frameNumber=frame.frameNumber, duration=frame.duration }
      end
      tags[#tags+1] = {
        index=i,
        name=tag.name,
        fromFrame=tag.fromFrame.frameNumber,
        toFrame=tag.toFrame.frameNumber,
        direction=ani_dir_name(tag.aniDir),
        repeats=tag.repeats,
        frames=frames
      }
    end
  end
  return tags
end

local function rgba(payload)
  return app.pixelColor.rgba(payload.r, payload.g, payload.b, payload.a)
end

local function draw_rect(image, x, y, width, height, color)
  for yy=y,y + height - 1 do
    for xx=x,x + width - 1 do
      image:drawPixel(xx, yy, color)
    end
  end
end

local function draw_dual_grid_digit(image, origin_x, origin_y, value, color)
  local glyphs = {
    ["0"]={"111","101","101","101","111"},
    ["1"]={"010","110","010","010","111"},
    ["2"]={"111","001","111","100","111"},
    ["3"]={"111","001","111","001","111"},
    ["4"]={"101","101","111","001","001"},
    ["5"]={"111","100","111","001","111"},
    ["6"]={"111","100","111","101","111"},
    ["7"]={"111","001","010","010","010"},
    ["8"]={"111","101","111","101","111"},
    ["9"]={"111","101","111","001","111"},
    ["A"]={"111","101","111","101","101"},
    ["B"]={"110","101","110","101","110"},
    ["C"]={"111","100","100","100","111"},
    ["D"]={"110","101","101","101","110"},
    ["E"]={"111","100","110","100","111"},
    ["F"]={"111","100","110","100","100"},
    ["G"]={"111","100","101","101","111"},
    ["V"]={"101","101","101","101","010"}
  }
  local text = value
  if type(value) ~= "string" then text = string.format("%X", value) end
  local glyph = glyphs[text]
  if glyph == nil then return end
  for row=1,#glyph do
    local line = glyph[row]
    for column=1,#line do
      if line:sub(column, column) == "1" then
        image:drawPixel(origin_x + column - 1, origin_y + row - 1, color)
      end
    end
  end
end

local function draw_dual_grid_glyph_scaled(image, origin_x, origin_y, value, color, scale)
  local glyphs = {
    ["G"]={"111","100","101","101","111"},
    ["V"]={"101","101","101","101","010"}
  }
  local glyph = glyphs[value]
  if glyph == nil then return end
  for row=1,#glyph do
    local line = glyph[row]
    for column=1,#line do
      if line:sub(column, column) == "1" then
        draw_rect(image, origin_x + (column - 1) * scale, origin_y + (row - 1) * scale, scale, scale, color)
      end
    end
  end
end

local function has_bit(value, bit)
  return math.floor(value / bit) % 2 == 1
end

local function pattern_has_ground(pattern, x_start, x_end, y_start, y_end)
  if pattern == nil then return false end
  for y=y_start,y_end do
    local row = pattern[y]
    if row ~= nil then
      for x=x_start,x_end do
        if row:sub(x, x) == "1" then return true end
      end
    end
  end
  return false
end

local function draw_dual_grid_quadrant_labels(image, tile_x, tile_y, tile_size, mask, pattern, colors)
  local half = math.floor(tile_size / 2)
  local pattern_height = pattern and #pattern or 2
  local pattern_width = pattern and string.len(pattern[1] or "") or 2
  local top_end = math.max(1, math.floor(pattern_height / 2))
  local bottom_start = math.min(pattern_height, top_end + 1)
  local left_end = math.max(1, math.floor(pattern_width / 2))
  local right_start = math.min(pattern_width, left_end + 1)
  local quadrants = {
    { bit=1, x=tile_x, y=tile_y, xs=1, xe=left_end, ys=1, ye=top_end },
    { bit=2, x=tile_x + half, y=tile_y, xs=right_start, xe=pattern_width, ys=1, ye=top_end },
    { bit=8, x=tile_x, y=tile_y + half, xs=1, xe=left_end, ys=bottom_start, ye=pattern_height },
    { bit=4, x=tile_x + half, y=tile_y + half, xs=right_start, xe=pattern_width, ys=bottom_start, ye=pattern_height }
  }
  local glyph_scale = math.max(1, math.floor(half / 8))
  local glyph_width = 3 * glyph_scale
  local glyph_height = 5 * glyph_scale
  for _, quadrant in ipairs(quadrants) do
    local ground = pattern ~= nil and pattern_has_ground(pattern, quadrant.xs, quadrant.xe, quadrant.ys, quadrant.ye) or has_bit(mask, quadrant.bit)
    local letter = ground and "G" or "V"
    local label_x = quadrant.x + math.floor((half - glyph_width) / 2)
    local label_y = quadrant.y + math.floor((half - glyph_height) / 2)
    draw_dual_grid_glyph_scaled(image, label_x + glyph_scale, label_y + glyph_scale, letter, colors.shadow, glyph_scale)
    draw_dual_grid_glyph_scaled(image, label_x, label_y, letter, colors.highlight, glyph_scale)
  end
end

local function pattern_cell_is_ground(pattern, x, y)
  if y < 1 or y > #pattern then return false end
  local row = pattern[y]
  if row == nil or x < 1 or x > string.len(row) then return false end
  return row:sub(x, x) == "1"
end

local function draw_pattern_tile(image, tile_x, tile_y, tile_size, pattern, colors)
  local pattern_height = #pattern
  if pattern_height == 0 then return end
  local pattern_width = string.len(pattern[1] or "")
  if pattern_width == 0 then return end

  for pattern_y=1,pattern_height do
    local row = pattern[pattern_y]
    for pattern_x=1,pattern_width do
      if row:sub(pattern_x, pattern_x) == "1" then
        local x1 = tile_x + math.floor((pattern_x - 1) * tile_size / pattern_width)
        local y1 = tile_y + math.floor((pattern_y - 1) * tile_size / pattern_height)
        local x2 = tile_x + math.floor(pattern_x * tile_size / pattern_width)
        local y2 = tile_y + math.floor(pattern_y * tile_size / pattern_height)
        local width = x2 - x1
        local height = y2 - y1
        draw_rect(image, x1, y1, width, height, colors.terrain)
        if not pattern_cell_is_ground(pattern, pattern_x, pattern_y - 1) then
          draw_rect(image, x1, y1, width, 2, colors.highlight)
        end
        if not pattern_cell_is_ground(pattern, pattern_x - 1, pattern_y) then
          draw_rect(image, x1, y1, 2, height, colors.highlight)
        end
        if not pattern_cell_is_ground(pattern, pattern_x + 1, pattern_y) then
          draw_rect(image, x2 - 2, y1, 2, height, colors.edge)
        end
        if not pattern_cell_is_ground(pattern, pattern_x, pattern_y + 1) then
          draw_rect(image, x1, y2 - 2, width, 2, colors.shadow)
        end
        if width >= 12 and height >= 12 then
          draw_rect(image, x1 + math.floor(width * 0.35), y1 + math.floor(height * 0.35), 1, 1, colors.highlight)
          draw_rect(image, x1 + math.floor(width * 0.65), y1 + math.floor(height * 0.65), 1, 1, colors.shadow)
        end
      end
    end
  end
end

local function draw_dual_grid_tile(image, tile_x, tile_y, tile_size, mask, pattern, colors, guide_mode, label_mode)
  local half = math.floor(tile_size / 2)
  draw_rect(image, tile_x, tile_y, tile_size, tile_size, colors.background)

  if pattern ~= nil then
    draw_pattern_tile(image, tile_x, tile_y, tile_size, pattern, colors)
  else
    local right = tile_size - half
    local bottom = tile_size - half
    local corners = {
      { bit=1, x=tile_x, y=tile_y, w=half, h=half },
      { bit=2, x=tile_x + half, y=tile_y, w=right, h=half },
      { bit=4, x=tile_x + half, y=tile_y + half, w=right, h=bottom },
      { bit=8, x=tile_x, y=tile_y + half, w=half, h=bottom }
    }
    for _, corner in ipairs(corners) do
      if has_bit(mask, corner.bit) then
        draw_rect(image, corner.x, corner.y, corner.w, corner.h, colors.terrain)
      end
    end
  end

  local center_x = tile_x + half
  local center_y = tile_y + half

  if colors.grid ~= nil and guide_mode ~= "none" then
    draw_rect(image, tile_x, tile_y, tile_size, 1, colors.grid)
    draw_rect(image, tile_x, tile_y + tile_size - 1, tile_size, 1, colors.grid)
    draw_rect(image, tile_x, tile_y, 1, tile_size, colors.grid)
    draw_rect(image, tile_x + tile_size - 1, tile_y, 1, tile_size, colors.grid)
    if guide_mode == "quadrant" then
      draw_rect(image, center_x, tile_y, 1, tile_size, colors.grid)
      draw_rect(image, tile_x, center_y, tile_size, 1, colors.grid)
    end
  end

  if label_mode == "mask" then
    draw_dual_grid_digit(image, tile_x + 2, tile_y + 2, mask, colors.shadow)
    draw_dual_grid_digit(image, tile_x + 1, tile_y + 1, mask, colors.highlight)
  elseif label_mode == "quadrants" then
    draw_dual_grid_quadrant_labels(image, tile_x, tile_y, tile_size, mask, pattern, colors)
  end
end

local raw = app.params["payload"]
if raw == nil then
  fail("MISSING_PAYLOAD", "Missing payload script-param.")
  return
end

local decoded = decode_base64(raw)
local request = json.decode(decoded)
local operation = request.operation
local payload = request.payload

local status, err = pcall(function()
  if operation == "create_sprite" then
    local sprite = Sprite(payload.width, payload.height, color_mode(payload.colorMode))
    sprite.transparentColor = payload.transparentColor or 0
    local layer = default_layer(sprite)
    layer.name = payload.background and "Background" or "Layer 1"
    for i=2,payload.frameCount do sprite:newEmptyFrame(i) end
    for i, frame in ipairs(sprite.frames) do frame.duration = payload.frameDurationMs / 1000.0 end
    if payload.background then
      for _, frame in ipairs(sprite.frames) do
        local cel = sprite:newCel(layer, frame.frameNumber)
        local image = cel.image
        local color = app.pixelColor.rgba(payload.background.r, payload.background.g, payload.background.b, payload.background.a)
        image:clear(color)
      end
    end
    sprite:saveAs(payload.outputPath)
    ok({ filePath=payload.outputPath, document=sprite_info(sprite), changes={ framesModified={}, layersModified={layer.name} }, warnings={} })
    sprite:close()
  elseif operation == "document_info" then
    local sprite = open_sprite(payload.filePath)
    ok({ filePath=payload.filePath, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "set_pixels" then
    local sprite = open_sprite(payload.filePath)
    for _, pixel in ipairs(payload.pixels) do set_pixel(sprite, payload.layerIndex, payload.frameIndex, pixel) end
    if payload.outputPath then sprite:saveAs(payload.outputPath) else sprite:saveAs(payload.filePath) end
    ok({ filePath=payload.outputPath or payload.filePath, changes={ pixelCount=#payload.pixels, framesModified={payload.frameIndex or 1}, layersModified={payload.layerIndex or 1} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "fill_region" then
    local sprite = open_sprite(payload.filePath)
    local count = 0
    for yy=payload.y,payload.y + payload.height - 1 do
      for xx=payload.x,payload.x + payload.width - 1 do
        if draw_point(sprite, payload.layerIndex, payload.frameIndex, xx, yy, payload.color) then count = count + 1 end
      end
    end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ pixelCount=count, framesModified={payload.frameIndex or 1}, layersModified={payload.layerIndex or 1} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "clear_region" then
    local sprite = open_sprite(payload.filePath)
    local count = 0
    for yy=payload.y,payload.y + payload.height - 1 do
      for xx=payload.x,payload.x + payload.width - 1 do
        if clear_point(sprite, payload.layerIndex, payload.frameIndex, xx, yy) then count = count + 1 end
      end
    end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ pixelCount=count, framesModified={payload.frameIndex or 1}, layersModified={payload.layerIndex or 1} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "draw_line" then
    local sprite = open_sprite(payload.filePath)
    local x1 = payload.x1
    local y1 = payload.y1
    local x2 = payload.x2
    local y2 = payload.y2
    local dx = math.abs(x2 - x1)
    local sx = x1 < x2 and 1 or -1
    local dy = -math.abs(y2 - y1)
    local sy = y1 < y2 and 1 or -1
    local err = dx + dy
    local count = 0
    while true do
      if draw_point(sprite, payload.layerIndex, payload.frameIndex, x1, y1, payload.color) then count = count + 1 end
      if x1 == x2 and y1 == y2 then break end
      local e2 = 2 * err
      if e2 >= dy then err = err + dy; x1 = x1 + sx end
      if e2 <= dx then err = err + dx; y1 = y1 + sy end
    end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ pixelCount=count, framesModified={payload.frameIndex or 1}, layersModified={payload.layerIndex or 1} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "draw_rectangle" then
    local sprite = open_sprite(payload.filePath)
    local count = 0
    for yy=payload.y,payload.y + payload.height - 1 do
      for xx=payload.x,payload.x + payload.width - 1 do
        if payload.filled or yy == payload.y or yy == payload.y + payload.height - 1 or xx == payload.x or xx == payload.x + payload.width - 1 then
          if draw_point(sprite, payload.layerIndex, payload.frameIndex, xx, yy, payload.color) then count = count + 1 end
        end
      end
    end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ pixelCount=count, framesModified={payload.frameIndex or 1}, layersModified={payload.layerIndex or 1} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "create_frame" then
    local sprite = open_sprite(payload.filePath)
    local frame
    if payload.copyFromFrame then frame = sprite:newFrame(payload.copyFromFrame) else frame = sprite:newEmptyFrame(payload.frameNumber or (#sprite.frames + 1)) end
    if payload.durationMs then frame.duration = payload.durationMs / 1000.0 end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ framesModified={frame.frameNumber}, layersModified={} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "animation_info" then
    local sprite = open_sprite(payload.filePath)
    ok({ filePath=payload.filePath, animations=animation_info(sprite, payload.tagName), document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "create_tag" then
    local sprite = open_sprite(payload.filePath)
    local tag = sprite:newTag(payload.fromFrame, payload.toFrame)
    tag.name = payload.name
    tag.aniDir = ani_dir(payload.direction)
    if payload.repeats then tag.repeats = payload.repeats end
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ framesModified={}, layersModified={}, tagsModified={tag.name} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "set_frame_duration" then
    local sprite = open_sprite(payload.filePath)
    local frame = sprite.frames[payload.frameNumber]
    if frame == nil then
      fail("FRAME_OUT_OF_RANGE", "Frame does not exist.", { requestedFrame=payload.frameNumber, availableFrames=#sprite.frames })
      sprite:close()
      return
    end
    frame.duration = payload.durationMs / 1000.0
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ framesModified={payload.frameNumber}, layersModified={} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "set_tag_range" then
    local sprite = open_sprite(payload.filePath)
    if payload.fromFrame > #sprite.frames or payload.toFrame > #sprite.frames then
      fail("FRAME_OUT_OF_RANGE", "Tag range references a missing frame.", { fromFrame=payload.fromFrame, toFrame=payload.toFrame, availableFrames=#sprite.frames })
      sprite:close()
      return
    end
    local tag = find_tag(sprite, payload.name)
    if tag == nil then
      fail("TAG_NOT_FOUND", "Tag does not exist.", { name=payload.name })
      sprite:close()
      return
    end
    tag.fromFrame = sprite.frames[payload.fromFrame]
    tag.toFrame = sprite.frames[payload.toFrame]
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ framesModified={}, layersModified={}, tagsModified={tag.name} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "set_tag_direction" then
    local sprite = open_sprite(payload.filePath)
    local tag = find_tag(sprite, payload.name)
    if tag == nil then
      fail("TAG_NOT_FOUND", "Tag does not exist.", { name=payload.name })
      sprite:close()
      return
    end
    tag.aniDir = ani_dir(payload.direction)
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, changes={ framesModified={}, layersModified={}, tagsModified={tag.name} }, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "save_document" then
    local sprite = open_sprite(payload.filePath)
    sprite:saveAs(payload.outputPath or payload.filePath)
    ok({ filePath=payload.outputPath or payload.filePath, document=sprite_info(sprite), warnings={} })
    sprite:close()
  elseif operation == "create_dual_grid_tileset" then
    local tile_size = payload.tileSize or 16
    local columns = payload.columns or 4
    local spacing = payload.spacing or 0
    local margin = payload.margin or 0
    local rows = math.ceil(16 / columns)
    local width = margin * 2 + columns * tile_size + (columns - 1) * spacing
    local height = margin * 2 + rows * tile_size + (rows - 1) * spacing
    local sprite = Sprite(width, height, ColorMode.RGB)
    local layer = default_layer(sprite)
    layer.name = "Dual Grid Tiles"
    local cel = sprite:newCel(layer, 1)
    local image = cel.image
    local colors = {
      terrain=rgba(payload.terrainColor),
      background=rgba(payload.backgroundColor),
      highlight=rgba(payload.highlightColor),
      shadow=rgba(payload.shadowColor),
      grid=payload.gridColor and rgba(payload.gridColor) or nil
    }
    image:clear(colors.background)
    for mask=0,15 do
      local column = mask % columns
      local row = math.floor(mask / columns)
      local tile_x = margin + column * (tile_size + spacing)
      local tile_y = margin + row * (tile_size + spacing)
      local pattern = payload.tilePatterns and payload.tilePatterns[mask + 1] or nil
      draw_dual_grid_tile(image, tile_x, tile_y, tile_size, mask, pattern, colors, payload.guideMode or "none", payload.labelMode or "none")
    end
    sprite:saveAs(payload.outputPath)
    ok({ filePath=payload.outputPath, tileSystem="dual-grid", tileCount=16, tileSize=tile_size, columns=columns, rows=rows, document=sprite_info(sprite), warnings={} })
    sprite:close()
  else
    fail("UNKNOWN_OPERATION", "Unknown operation: " .. tostring(operation))
  end
end)

if not status then
  fail("LUA_RUNTIME_ERROR", tostring(err))
end
`;
