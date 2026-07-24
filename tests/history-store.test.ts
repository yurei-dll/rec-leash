import { describe, expect, it } from "vitest";
import { MemoryHistoryStore } from "../src/shared/history-store";
import { JsonHistoryImporter, stringifyHistoryExport } from "../src/shared/import-export";

describe("history store", () => {
  it("deduplicates records by video ID and updates metadata", async () => {
    const store = new MemoryHistoryStore();
    await store.upsert({
      videoId: "abc_DEF-123",
      firstObservedAt: "2026-01-01T00:00:00.000Z",
      lastObservedAt: "2026-01-01T00:00:00.000Z",
      title: "Original",
      source: "watch-page"
    });

    const merged = await store.upsert({
      videoId: "abc_DEF-123",
      firstObservedAt: "2026-01-02T00:00:00.000Z",
      lastObservedAt: "2026-01-03T00:00:00.000Z",
      channel: "Channel",
      source: "watch-page",
      playbackProgressSeconds: 31
    });

    expect(await store.count()).toBe(1);
    expect(merged.title).toBe("Original");
    expect(merged.channel).toBe("Channel");
    expect(merged.firstObservedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(merged.lastObservedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("exports and imports the JSON format", async () => {
    const store = new MemoryHistoryStore();
    await store.upsert({
      videoId: "abc_DEF-123",
      firstObservedAt: "2026-01-01T00:00:00.000Z",
      lastObservedAt: "2026-01-01T00:00:00.000Z",
      source: "watch-page"
    });

    const exported = stringifyHistoryExport(await store.exportHistory());
    const imported = new JsonHistoryImporter().parse(exported);

    expect(imported).toHaveLength(1);
    expect(imported[0]?.videoId).toBe("abc_DEF-123");
  });
});
