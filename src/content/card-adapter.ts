import { extractVideoIdFromUrl } from "../shared/video-id";

const CARD_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
  "yt-lockup-view-model",
  "ytm-video-with-context-renderer"
].join(",");

export interface CandidateCard {
  element: HTMLElement;
  videoIds: string[];
}

export class YouTubeCardAdapter {
  findCandidateCards(root: ParentNode): CandidateCard[] {
    const anchors = this.#watchAnchors(root);
    const byElement = new Map<HTMLElement, Set<string>>();

    for (const anchor of anchors) {
      const videoId = extractVideoIdFromUrl(anchor.href);
      if (!videoId) {
        continue;
      }

      const card = this.findCardContainer(anchor);
      if (!card || this.#isExcluded(anchor)) {
        continue;
      }

      if (!byElement.has(card)) {
        byElement.set(card, new Set());
      }
      byElement.get(card)?.add(videoId);
    }

    return [...byElement.entries()].map(([element, ids]) => ({
      element,
      videoIds: [...ids]
    }));
  }

  findCardContainer(anchor: HTMLAnchorElement): HTMLElement | null {
    const container = anchor.closest(CARD_SELECTOR);
    if (container instanceof HTMLElement) {
      return container;
    }

    return anchor.parentElement;
  }

  #watchAnchors(root: ParentNode): HTMLAnchorElement[] {
    const anchors: HTMLAnchorElement[] = [];
    if (root instanceof HTMLAnchorElement) {
      anchors.push(root);
    }

    if ("querySelectorAll" in root) {
      anchors.push(...Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href*='/watch?v=']")));
    }

    return anchors;
  }

  #isExcluded(anchor: HTMLAnchorElement): boolean {
    const href = anchor.getAttribute("href") ?? "";
    return href.includes("/playlist?") || href.includes("/shorts/");
  }
}
