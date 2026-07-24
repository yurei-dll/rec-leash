import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationCardFilter } from "../src/content/card-filter";
import { YouTubeCardAdapter } from "../src/content/card-adapter";
import { MemoryHistoryStore } from "../src/shared/history-store";

describe("RecommendationCardFilter", () => {
  let store: MemoryHistoryStore;

  beforeEach(async () => {
    const dom = new JSDOM("<!doctype html><body></body>", {
      url: "https://www.youtube.com/"
    });
    Object.assign(globalThis, {
      document: dom.window.document,
      window: dom.window,
      HTMLElement: dom.window.HTMLElement,
      HTMLAnchorElement: dom.window.HTMLAnchorElement,
      MutationObserver: dom.window.MutationObserver
    });
    vi.spyOn(window, "setTimeout").mockImplementation((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }
      return 1;
    });
    store = new MemoryHistoryStore();
    await store.upsert({
      videoId: "abc_DEF-123",
      firstObservedAt: "2026-01-01T00:00:00.000Z",
      lastObservedAt: "2026-01-01T00:00:00.000Z",
      source: "watch-page"
    });
  });

  it("marks watched cards and does not duplicate badges on rescans", async () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer id="card">
        <a href="/watch?v=abc_DEF-123">Video</a>
        <a href="/watch?v=abc_DEF-123&feature=share">Duplicate</a>
      </ytd-rich-item-renderer>
    `;

    const filter = new RecommendationCardFilter(store, { displayMode: "badge" }, new YouTubeCardAdapter());
    filter.enqueue(document.body);
    await filter.flush();
    filter.enqueue(document.body);
    await filter.flush();

    const card = document.querySelector<HTMLElement>("#card");
    expect(card?.querySelectorAll(".recommendation-leash-badge")).toHaveLength(1);
    expect(card?.getAttribute("data-recommendation-leash-state")).toBe("badge");
  });

  it("ignores unrelated links", async () => {
    document.body.innerHTML = `
      <div id="card">
        <a href="/channel/abc_DEF-123">Channel</a>
      </div>
    `;

    const filter = new RecommendationCardFilter(store, { displayMode: "badge" }, new YouTubeCardAdapter());
    filter.enqueue(document.body);
    await filter.flush();

    expect(document.querySelector(".recommendation-leash-badge")).toBeNull();
  });

  it("applies dynamically inserted cards", async () => {
    const filter = new RecommendationCardFilter(store, { displayMode: "dim" }, new YouTubeCardAdapter());
    const card = document.createElement("ytd-compact-video-renderer");
    card.innerHTML = `<a href="/watch?v=abc_DEF-123">Video</a>`;
    document.body.append(card);

    filter.enqueue(card);
    await filter.flush();

    expect(card.classList.contains("recommendation-leash-dim")).toBe(true);
  });

  it("restores cards when settings change to disabled", async () => {
    document.body.innerHTML = `
      <ytd-video-renderer id="card">
        <a href="/watch?v=abc_DEF-123">Video</a>
      </ytd-video-renderer>
    `;

    const filter = new RecommendationCardFilter(store, { displayMode: "hide" }, new YouTubeCardAdapter());
    filter.enqueue(document.body);
    await filter.flush();
    filter.setDisplayMode("disabled");

    const card = document.querySelector<HTMLElement>("#card");
    expect(card?.classList.contains("recommendation-leash-hide")).toBe(false);
    expect(card?.querySelector(".recommendation-leash-badge")).toBeNull();
  });
});
