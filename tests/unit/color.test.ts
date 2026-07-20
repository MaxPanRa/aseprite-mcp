import { describe, expect, it } from "vitest";
import { normalizeColor, rgbaToHex } from "../../src/utils/color.js";

describe("color utilities", () => {
  it("normalizes #RRGGBB as opaque RGBA", () => {
    expect(normalizeColor("#FFAA00")).toEqual({ r: 255, g: 170, b: 0, a: 255 });
  });

  it("normalizes #RRGGBBAA", () => {
    expect(normalizeColor("#11223344")).toEqual({ r: 17, g: 34, b: 51, a: 68 });
  });

  it("formats RGBA to uppercase hex", () => {
    expect(rgbaToHex({ r: 1, g: 2, b: 254, a: 255 })).toBe("#0102FEFF");
  });
});
