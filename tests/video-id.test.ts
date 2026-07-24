import { describe, expect, it } from "vitest";
import { extractVideoIdFromUrl } from "../src/shared/video-id";

describe("extractVideoIdFromUrl", () => {
  it("extracts normal YouTube watch URLs", () => {
    expect(extractVideoIdFromUrl("https://www.youtube.com/watch?v=abc_DEF-123")).toBe("abc_DEF-123");
  });

  it("extracts relative watch URLs", () => {
    expect(extractVideoIdFromUrl("/watch?v=abc_DEF-123&list=playlist")).toBe("abc_DEF-123");
  });

  it("extracts youtu.be links", () => {
    expect(extractVideoIdFromUrl("https://youtu.be/abc_DEF-123?t=10")).toBe("abc_DEF-123");
  });

  it("rejects shorts and unrelated URLs", () => {
    expect(extractVideoIdFromUrl("https://www.youtube.com/shorts/abc_DEF-123")).toBeNull();
    expect(extractVideoIdFromUrl("https://example.com/watch?v=abc_DEF-123")).toBeNull();
    expect(extractVideoIdFromUrl("https://www.youtube.com/channel/abc_DEF-123")).toBeNull();
  });
});
