import { describe, expect, it } from "vitest";
import { FileLockManager } from "../../src/security/file-lock-manager.js";

describe("FileLockManager", () => {
  it("serializes operations on the same file", async () => {
    const locks = new FileLockManager();
    const events: string[] = [];
    await Promise.all([
      locks.withFileLock("a.aseprite", async () => {
        events.push("a1-start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push("a1-end");
      }),
      locks.withFileLock("a.aseprite", async () => {
        events.push("a2-start");
        events.push("a2-end");
      }),
    ]);
    expect(events).toEqual(["a1-start", "a1-end", "a2-start", "a2-end"]);
  });
});
