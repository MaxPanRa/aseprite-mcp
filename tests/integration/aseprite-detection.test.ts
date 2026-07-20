import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/config.js";
import { AsepriteDiscovery } from "../../src/aseprite/discovery.js";

describe("Aseprite detection", () => {
  it("reports detection status without requiring Aseprite", async () => {
    const config = await loadConfig();
    const info = await new AsepriteDiscovery(config).detect();
    expect(info).toHaveProperty("available");
    expect(info).toHaveProperty("checkedPaths");
  });
});
