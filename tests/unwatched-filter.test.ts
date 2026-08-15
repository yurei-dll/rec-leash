import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
import { UnwatchedChipController } from "../src/content/unwatched-filter";

describe("UnwatchedChipController", () => {
  beforeEach(() => {
    const dom = new JSDOM(`<!doctype html><body>
      <ytd-feed-filter-chip-bar-renderer>
        <div id="chips">
          <yt-chip-cloud-chip-renderer class="iron-selected" selected aria-selected="true">
            <div id="text">All</div>
          </yt-chip-cloud-chip-renderer>
          <yt-chip-cloud-chip-renderer><div id="text">Gaming</div></yt-chip-cloud-chip-renderer>
        </div>
      </ytd-feed-filter-chip-bar-renderer>
      <ytd-rich-item-renderer id="watched" data-rec-leash-watched="true"></ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="fresh" data-rec-leash-watched="false"></ytd-rich-item-renderer>
    </body>`, { url: "https://www.youtube.com/" });
    Object.assign(globalThis, {
      document: dom.window.document,
      window: dom.window,
      Element: dom.window.Element,
      HTMLElement: dom.window.HTMLElement,
      MutationObserver: dom.window.MutationObserver
    });
  });

  it("adds an opt-in chip after All and filters only locally watched cards", () => {
    const controller = new UnwatchedChipController(true);
    controller.start();

    const chip = document.querySelector<HTMLElement>(".rec-leash-unwatched-chip");
    expect(chip?.textContent?.trim()).toBe("Unwatched");
    expect(chip?.previousElementSibling?.textContent?.trim()).toBe("All");

    chip?.click();
    expect(document.querySelector("#watched")?.classList.contains("rec-leash-unwatched-filtered")).toBe(true);
    expect(document.querySelector("#fresh")?.classList.contains("rec-leash-unwatched-filtered")).toBe(false);

    chip?.click();
    expect(document.querySelector("#watched")?.classList.contains("rec-leash-unwatched-filtered")).toBe(false);
    controller.stop();
  });

  it("removes the chip and restores cards when disabled", () => {
    const controller = new UnwatchedChipController(true);
    controller.start();
    document.querySelector<HTMLElement>(".rec-leash-unwatched-chip")?.click();

    controller.setEnabled(false);
    expect(document.querySelector(".rec-leash-unwatched-chip")).toBeNull();
    expect(document.querySelector(".rec-leash-unwatched-filtered")).toBeNull();
    controller.stop();
  });
});
