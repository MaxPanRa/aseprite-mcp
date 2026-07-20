import { describe, expect, it } from "vitest";
import { REFERENCE_DUAL_GRID_PIXEL_STENCIL } from "../../src/tools/tileset/index.js";

function quadrantLabelsFromStencil(referenceStencil: readonly string[], columns: number, rows: number): string[] {
  const tileWidth = Math.floor((referenceStencil[0]?.length ?? 0) / columns);
  const tileHeight = Math.floor(referenceStencil.length / rows);
  const quadrantWidth = Math.floor(tileWidth / 2);
  const quadrantHeight = Math.floor(tileHeight / 2);
  const labels: string[] = [];

  for (let tileRow = 0; tileRow < rows; tileRow += 1) {
    const topLabels: string[] = [];
    const bottomLabels: string[] = [];
    for (let tileColumn = 0; tileColumn < columns; tileColumn += 1) {
      const x = tileColumn * tileWidth;
      const y = tileRow * tileHeight;
      const hasGround = (xStart: number, yStart: number) => {
        for (let row = yStart; row < yStart + quadrantHeight; row += 1) {
          for (let column = xStart; column < xStart + quadrantWidth; column += 1) {
            if (referenceStencil[row]?.[column] === "1") return true;
          }
        }
        return false;
      };

      topLabels.push(hasGround(x, y) ? "G" : "V", hasGround(x + quadrantWidth, y) ? "G" : "V");
      bottomLabels.push(
        hasGround(x, y + quadrantHeight) ? "G" : "V",
        hasGround(x + quadrantWidth, y + quadrantHeight) ? "G" : "V",
      );
    }
    labels.push(topLabels.join(""), bottomLabels.join(""));
  }

  return labels;
}

describe("dual-grid template stencil", () => {
  it("matches the magenta template quadrant order with G for ground and V for void", () => {
    expect(quadrantLabelsFromStencil(REFERENCE_DUAL_GRID_PIXEL_STENCIL, 4, 4)).toEqual([
      "VVGVVGGG",
      "VVVVVVVV",
      "VVGVVGGG",
      "VGVGVVVG",
      "VVGVVGGG",
      "GVGVGVGV",
      "VVGVVGGG",
      "GGGGVGGG",
    ]);
  });
});
