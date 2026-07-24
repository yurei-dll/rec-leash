import { savePageDiagnostics } from "../shared/diagnostics";
import type { HistoryStore } from "../shared/history-store";
import type { DisplayMode, PageDiagnostics } from "../shared/types";
import { YouTubeCardAdapter, type CandidateCard } from "./card-adapter";

const BADGE_CLASS = "recommendation-leash-badge";
const CARD_ATTR = "data-recommendation-leash-state";

export class RecommendationCardFilter {
  #store: HistoryStore;
  #adapter: YouTubeCardAdapter;
  #settings: { displayMode: DisplayMode };
  #pendingRoots = new Set<ParentNode>();
  #timer: number | undefined;
  #observer?: MutationObserver;
  readonly diagnostics: PageDiagnostics = {
    cardsScanned: 0,
    cardsMatched: 0,
    cardsModified: 0
  };

  constructor(
    store: HistoryStore,
    settings: { displayMode: DisplayMode },
    adapter = new YouTubeCardAdapter()
  ) {
    this.#store = store;
    this.#settings = settings;
    this.#adapter = adapter;
  }

  start(): void {
    this.enqueue(document.body);
    this.#observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            this.enqueue(node);
          }
        });
      }
    });
    this.#observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.#observer?.disconnect();
    if (this.#timer !== undefined) {
      window.clearTimeout(this.#timer);
    }
  }

  setDisplayMode(displayMode: DisplayMode): void {
    this.#settings.displayMode = displayMode;
    this.applyModeToExistingCards();
  }

  enqueue(root: ParentNode): void {
    this.#pendingRoots.add(root);
    if (this.#timer !== undefined) {
      return;
    }

    this.#timer = window.setTimeout(() => {
      this.#timer = undefined;
      void this.flush();
    }, 150);
  }

  async flush(): Promise<PageDiagnostics> {
    const roots = [...this.#pendingRoots];
    this.#pendingRoots.clear();
    const cards = dedupeCards(roots.flatMap((root) => this.#adapter.findCandidateCards(root)));

    for (const card of cards) {
      await this.#processCard(card);
    }

    await savePageDiagnostics(this.diagnostics);
    return { ...this.diagnostics };
  }

  applyModeToExistingCards(): void {
    document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((card) => {
      const isWatched = card.dataset.recommendationLeashWatched === "true";
      if (!isWatched || this.#settings.displayMode === "disabled") {
        restoreCard(card);
        return;
      }
      mutateCard(card, this.#settings.displayMode);
    });
  }

  async #processCard(card: CandidateCard): Promise<void> {
    this.diagnostics.cardsScanned += 1;
    const watched = await this.#containsWatchedVideo(card.videoIds);
    card.element.dataset.recommendationLeashWatched = String(watched);

    if (!watched || this.#settings.displayMode === "disabled") {
      restoreCard(card.element);
      return;
    }

    this.diagnostics.cardsMatched += 1;
    if (mutateCard(card.element, this.#settings.displayMode)) {
      this.diagnostics.cardsModified += 1;
    }
  }

  async #containsWatchedVideo(videoIds: string[]): Promise<boolean> {
    for (const videoId of videoIds) {
      if (await this.#store.has(videoId)) {
        return true;
      }
    }
    return false;
  }
}

export function mutateCard(card: HTMLElement, mode: DisplayMode): boolean {
  const previousState = card.getAttribute(CARD_ATTR);
  card.setAttribute(CARD_ATTR, mode);
  ensureBadge(card);
  card.classList.toggle("recommendation-leash-dim", mode === "dim");
  card.classList.toggle("recommendation-leash-hide", mode === "hide");
  return previousState !== mode;
}

export function restoreCard(card: HTMLElement): void {
  card.removeAttribute(CARD_ATTR);
  card.classList.remove("recommendation-leash-dim", "recommendation-leash-hide");
  card.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function ensureBadge(card: HTMLElement): void {
  if (card.querySelector(`.${BADGE_CLASS}`)) {
    return;
  }

  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.textContent = "WATCHED";
  card.prepend(badge);
}

function dedupeCards(cards: CandidateCard[]): CandidateCard[] {
  const byElement = new Map<HTMLElement, Set<string>>();
  for (const card of cards) {
    const ids = byElement.get(card.element) ?? new Set<string>();
    card.videoIds.forEach((id) => ids.add(id));
    byElement.set(card.element, ids);
  }

  return [...byElement.entries()].map(([element, ids]) => ({ element, videoIds: [...ids] }));
}
