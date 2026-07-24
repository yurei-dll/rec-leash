import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/shared/settings";

describe("settings", () => {
  it("defaults to visible diagnostic badge mode", () => {
    expect(normalizeSettings({}).displayMode).toBe("badge");
  });

  it("accepts supported modes and rejects unknown modes", () => {
    expect(normalizeSettings({ displayMode: "hide" }).displayMode).toBe("hide");
    expect(normalizeSettings({ displayMode: "unknown" }).displayMode).toBe("badge");
  });
});
