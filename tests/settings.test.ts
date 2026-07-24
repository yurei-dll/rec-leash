import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/shared/settings";

describe("settings", () => {
  it("defaults to visible diagnostic badge mode", () => {
    expect(normalizeSettings({}).displayMode).toBe("badge");
    expect(normalizeSettings({}).debugLogging).toBe(true);
  });

  it("accepts supported modes and rejects unknown modes", () => {
    expect(normalizeSettings({ displayMode: "hide" }).displayMode).toBe("hide");
    expect(normalizeSettings({ displayMode: "unknown" }).displayMode).toBe("badge");
  });

  it("normalizes debug logging", () => {
    expect(normalizeSettings({ debugLogging: false }).debugLogging).toBe(false);
    expect(normalizeSettings({ debugLogging: "nope" }).debugLogging).toBe(true);
  });
});
