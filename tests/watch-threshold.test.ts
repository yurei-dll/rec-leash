import { describe, expect, it } from "vitest";
import { PlaybackThresholdTracker } from "../src/content/watch-threshold";

describe("PlaybackThresholdTracker", () => {
  it("requires accumulated playback time before becoming ready", () => {
    let now = 0;
    const tracker = new PlaybackThresholdTracker({ thresholdSeconds: 30, nowMs: () => now });

    tracker.switchVideo("abc_DEF-123");
    tracker.onPlay();
    now = 29_000;
    expect(tracker.tick()).toBe(false);
    now = 30_000;
    expect(tracker.tick()).toBe(true);
    expect(tracker.progressSeconds).toBe(30);
  });

  it("resets safely across videos", () => {
    let now = 0;
    const tracker = new PlaybackThresholdTracker({ thresholdSeconds: 30, nowMs: () => now });

    tracker.switchVideo("abc_DEF-123");
    tracker.onPlay();
    now = 20_000;
    tracker.switchVideo("def_ABC-456");

    tracker.onPlay();
    now = 29_000;
    expect(tracker.tick()).toBe(false);
  });

  it("distinguishes an already recorded video from one below the threshold", () => {
    let now = 0;
    const tracker = new PlaybackThresholdTracker({ thresholdSeconds: 30, nowMs: () => now });

    tracker.switchVideo("abc_DEF-123");
    tracker.onPlay();
    now = 34_000;
    expect(tracker.tick()).toBe(true);

    tracker.markRecorded();
    expect(tracker.isRecorded).toBe(true);
    expect(tracker.tick()).toBe(false);
    expect(tracker.progressSeconds).toBe(34);
  });
});
