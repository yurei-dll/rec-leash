import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { RepresentativeTakeoutImporter } from "../src/shared/import-export";

describe("RepresentativeTakeoutImporter", () => {
  it("parses representative Takeout fixture rows", async () => {
    const fixture = await readFile("tests/fixtures/takeout-watch-history.json", "utf8");
    const records = new RepresentativeTakeoutImporter().parse(fixture);

    expect(records).toEqual([
      {
        videoId: "abc_DEF-123",
        firstObservedAt: "2026-01-01T00:00:00.000Z",
        lastObservedAt: "2026-01-01T00:00:00.000Z",
        title: "A Useful Video",
        channel: "Useful Channel",
        source: "import"
      }
    ]);
  });
});
