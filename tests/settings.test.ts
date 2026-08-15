import { describe, expect, it } from "vitest";
import { getSettings, normalizeSettings, saveSettings } from "../src/shared/settings";

describe("settings", () => {
  it("defaults to badge-and-dim mode with quiet logging", () => {
    expect(normalizeSettings({}).displayMode).toBe("dim");
    expect(normalizeSettings({}).watchStatusSource).toBe("playtime");
    expect(normalizeSettings({}).showUnwatchedChip).toBe(false);
    expect(normalizeSettings({}).debugLogging).toBe(false);
  });

  it("normalizes watch-status sources", () => {
    expect(normalizeSettings({ watchStatusSource: "playtime-or-card-progress" }).watchStatusSource).toBe(
      "playtime-or-card-progress"
    );
    expect(normalizeSettings({ watchStatusSource: "unknown" }).watchStatusSource).toBe("playtime");
  });

  it("accepts supported modes and rejects unknown modes", () => {
    expect(normalizeSettings({ displayMode: "hide" }).displayMode).toBe("hide");
    expect(normalizeSettings({ displayMode: "unknown" }).displayMode).toBe("dim");
  });

  it("normalizes debug logging", () => {
    expect(normalizeSettings({ debugLogging: true }).debugLogging).toBe(true);
    expect(normalizeSettings({ debugLogging: false }).debugLogging).toBe(false);
    expect(normalizeSettings({ debugLogging: "nope" }).debugLogging).toBe(false);
  });

  it("round-trips persisted settings and preserves fields during partial updates", async () => {
    await browser.storage.local.clear();
    await saveSettings({
      displayMode: "dim",
      watchStatusSource: "playtime-or-card-progress",
      showUnwatchedChip: true,
      debugLogging: false
    });

    expect(await getSettings()).toEqual({
      displayMode: "dim",
      watchStatusSource: "playtime-or-card-progress",
      showUnwatchedChip: true,
      debugLogging: false
    });

    await saveSettings({ displayMode: "hide" });
    expect(await getSettings()).toEqual({
      displayMode: "hide",
      watchStatusSource: "playtime-or-card-progress",
      showUnwatchedChip: true,
      debugLogging: false
    });
  });
});
