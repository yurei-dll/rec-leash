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
    expect(card?.querySelectorAll(".rec-leash-badge")).toHaveLength(1);
    expect(card?.getAttribute("data-rec-leash-state")).toBe("badge");
  });

  it("mutates the outer grid item when YouTube nests a lockup view model", async () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer id="grid-item">
        <div id="content">
          <yt-lockup-view-model id="lockup">
            <a href="/watch?v=abc_DEF-123">Video</a>
          </yt-lockup-view-model>
        </div>
      </ytd-rich-item-renderer>
    `;

    const filter = new RecommendationCardFilter(store, { displayMode: "hide" }, new YouTubeCardAdapter());
    filter.enqueue(document.body);
    await filter.flush();

    expect(document.querySelector("#grid-item")?.classList.contains("rec-leash-hide")).toBe(true);
    expect(document.querySelector("#lockup")?.classList.contains("rec-leash-hide")).toBe(false);
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

    expect(document.querySelector(".rec-leash-badge")).toBeNull();
  });

  it("does not attach badges to watch links in expanded or nested comments", async () => {
    document.body.innerHTML = `
      <ytd-comment-thread-renderer id="comment">
        <div id="content-text">
          <yt-lockup-view-model id="comment-lockup">
            Try <a href="/watch?v=abc_DEF-123">this watched video</a>
          </yt-lockup-view-model>
        </div>
      </ytd-comment-thread-renderer>
    `;

    const filter = new RecommendationCardFilter(store, { displayMode: "badge" }, new YouTubeCardAdapter());
    filter.enqueue(document.body);
    await filter.flush();

    expect(document.querySelector("#comment .rec-leash-badge")).toBeNull();
    expect(document.querySelector("#comment-lockup")?.hasAttribute("data-rec-leash-state")).toBe(false);
    expect(document.querySelector("#content-text")?.hasAttribute("data-rec-leash-state")).toBe(false);
  });

  it("applies dynamically inserted cards", async () => {
    const filter = new RecommendationCardFilter(store, { displayMode: "dim" }, new YouTubeCardAdapter());
    const card = document.createElement("ytd-compact-video-renderer");
    card.innerHTML = `<a href="/watch?v=abc_DEF-123">Video</a>`;
    document.body.append(card);

    filter.enqueue(card);
    await filter.flush();

    expect(card.classList.contains("rec-leash-dim")).toBe(true);
  });

  it.each([
    ["the legacy partial-progress overlay", `<ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width: 68%"></div></ytd-thumbnail-overlay-resume-playback-renderer>`],
    ["the current full-progress segment", `<div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width: 100%"></div>`]
  ])("can treat %s as watched", async (_description, progressMarkup) => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer id="card">
        <a href="/watch?v=new_Video-1">Video</a>
        ${progressMarkup}
      </ytd-rich-item-renderer>
    `;

    const filter = new RecommendationCardFilter(
      store,
      { displayMode: "badge", watchStatusSource: "playtime-or-card-progress" },
      new YouTubeCardAdapter()
    );
    filter.enqueue(document.body);
    await filter.flush();

    expect(document.querySelector("#card .rec-leash-badge")).not.toBeNull();
  });

  it("does not treat an empty progress segment as watched", async () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer id="card">
        <a href="/watch?v=new_Video-1">Video</a>
        <div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width: 0%"></div>
      </ytd-rich-item-renderer>
    `;

    const filter = new RecommendationCardFilter(
      store,
      { displayMode: "badge", watchStatusSource: "playtime-or-card-progress" },
      new YouTubeCardAdapter()
    );
    filter.enqueue(document.body);
    await filter.flush();

    expect(document.querySelector("#card .rec-leash-badge")).toBeNull();
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
    expect(card?.classList.contains("rec-leash-hide")).toBe(false);
    expect(card?.querySelector(".rec-leash-badge")).toBeNull();
  });

  it("does not rescan the page when settings values are unchanged", async () => {
    document.body.innerHTML = `
      <ytd-video-renderer id="card">
        <a href="/watch?v=abc_DEF-123">Video</a>
      </ytd-video-renderer>
    `;

    const filter = new RecommendationCardFilter(
      store,
      { displayMode: "badge", watchStatusSource: "playtime" },
      new YouTubeCardAdapter()
    );
    filter.enqueue(document.body);
    await filter.flush();
    const scannedBeforeSettingsWrite = filter.diagnostics.cardsScanned;
    const matchedBeforeSettingsWrite = filter.diagnostics.cardsMatched;

    filter.setDisplayMode("badge");
    filter.setWatchStatusSource("playtime");
    await filter.flush();

    expect(filter.diagnostics.cardsScanned).toBe(scannedBeforeSettingsWrite);
    expect(filter.diagnostics.cardsMatched).toBe(matchedBeforeSettingsWrite);
  });
});
