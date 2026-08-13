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

const WATCH_PROGRESS_SELECTOR = [
  "ytd-thumbnail-overlay-resume-playback-renderer #progress",
  "ytm-thumbnail-overlay-resume-playback-renderer #progress",
  "yt-thumbnail-overlay-resume-playback-renderer #progress",
  ".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment"
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

    return null;
  }

  hasWatchProgressBar(card: HTMLElement): boolean {
    return Array.from(card.querySelectorAll<HTMLElement>(WATCH_PROGRESS_SELECTOR)).some((progress) => {
      const width = Number.parseFloat(progress.style.width);
      return Number.isFinite(width) && width > 0;
    });
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
