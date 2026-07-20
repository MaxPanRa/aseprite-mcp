import { z } from "zod";

export const RgbaSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().int().min(0).max(255).default(255),
});

export const ColorSchema = z.union([
  z.string().regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/),
  RgbaSchema,
]);

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function normalizeColor(color: z.infer<typeof ColorSchema>): Rgba {
  if (typeof color === "string") {
    const hex = color.slice(1);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
    };
  }
  return color;
}

export function rgbaToHex(color: Rgba): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}${toHex(color.a)}`;
}
