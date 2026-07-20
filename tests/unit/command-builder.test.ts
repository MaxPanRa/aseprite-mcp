import { describe, expect, it } from "vitest";
import { buildExportPngArgs, buildExportSpritesheetArgs } from "../../src/aseprite/command-builder.js";

describe("command builder", () => {
  it("builds png export args without shell concatenation", () => {
    expect(buildExportPngArgs("in.aseprite", "out.png")).toEqual(["--batch", "in.aseprite", "--save-as", "out.png"]);
  });

  it("builds spritesheet args with metadata flags", () => {
    expect(
      buildExportSpritesheetArgs({
        inputPath: "in.aseprite",
        sheetPath: "sheet.png",
        dataPath: "sheet.json",
        sheetType: "horizontal",
        listLayers: true,
        listTags: true,
        trim: true,
      }),
    ).toEqual([
      "--batch",
      "in.aseprite",
      "--trim",
      "--sheet-type",
      "horizontal",
      "--list-layers",
      "--list-tags",
      "--sheet",
      "sheet.png",
      "--data",
      "sheet.json",
    ]);
  });
});
