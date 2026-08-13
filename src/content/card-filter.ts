import { savePageDiagnostics } from "../shared/diagnostics";
import type { HistoryStore } from "../shared/history-store";
import type { Logger } from "../shared/logger";
import type { DisplayMode, PageDiagnostics, WatchStatusSource } from "../shared/types";
import { YouTubeCardAdapter, type CandidateCard } from "./card-adapter";

const BADGE_CLASS = "rec-leash-badge";
const CARD_ATTR = "data-rec-leash-state";

export class RecommendationCardFilter {
  #store: HistoryStore;
  #adapter: YouTubeCardAdapter;
  #logger: Logger | undefined;
  #settings: { displayMode: DisplayMode; watchStatusSource: WatchStatusSource };
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
    settings: { displayMode: DisplayMode; watchStatusSource?: WatchStatusSource },
    adapter = new YouTubeCardAdapter(),
    logger?: Logger
  ) {
    this.#store = store;
    this.#settings = { displayMode: settings.displayMode, watchStatusSource: settings.watchStatusSource ?? "playtime" };
    this.#adapter = adapter;
    this.#logger = logger;
  }

  start(): void {
    this.#logger?.info("recommendation card filter started", { displayMode: this.#settings.displayMode });
    this.enqueue(document.body);
    this.#observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            this.#logger?.debug("mutation queued", {
              tagName: node.tagName.toLowerCase(),
              childElementCount: node.childElementCount
            });
            this.enqueue(node);
          }
        });
      }
    });
    this.#observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.#logger?.info("recommendation card filter stopped");
    this.#observer?.disconnect();
    if (this.#timer !== undefined) {
      window.clearTimeout(this.#timer);
    }
  }

  setDisplayMode(displayMode: DisplayMode): void {
    if (displayMode === this.#settings.displayMode) {
      return;
    }
    this.#logger?.info("display mode changed", { displayMode });
    this.#settings.displayMode = displayMode;
    this.applyModeToExistingCards();
  }

  setWatchStatusSource(watchStatusSource: WatchStatusSource): void {
    if (watchStatusSource === this.#settings.watchStatusSource) {
      return;
    }
    this.#logger?.info("watch status source changed", { watchStatusSource });
    this.#settings.watchStatusSource = watchStatusSource;
    this.enqueue(document.body);
  }

  enqueue(root: ParentNode): void {
    this.#pendingRoots.add(root);
    this.#logger?.debug("scan root enqueued", {
      pendingRoots: this.#pendingRoots.size,
      root: root instanceof HTMLElement ? root.tagName.toLowerCase() : root.nodeName
    });
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
    this.#logger?.debug("scan batch started", { roots: roots.length, candidateCards: cards.length });

    for (const card of cards) {
      await this.#processCard(card);
    }

    await savePageDiagnostics(this.diagnostics);
    this.#logger?.debug("scan batch finished", this.diagnostics);
    return { ...this.diagnostics };
  }

  applyModeToExistingCards(): void {
    let restored = 0;
    let reapplied = 0;
    document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((card) => {
      const isWatched = card.dataset.recLeashWatched === "true";
      if (!isWatched || this.#settings.displayMode === "disabled") {
        restoreCard(card);
        restored += 1;
        return;
      }
      mutateCard(card, this.#settings.displayMode);
      reapplied += 1;
    });
    this.#logger?.debug("existing cards updated for display mode", { restored, reapplied });
  }

  async #processCard(card: CandidateCard): Promise<void> {
    this.diagnostics.cardsScanned += 1;
    const watched = await this.#isWatched(card);
    card.element.dataset.recLeashWatched = String(watched);
    this.#logger?.debug("card scanned", {
      videoIds: card.videoIds,
      watched,
      watchStatusSource: this.#settings.watchStatusSource,
      displayMode: this.#settings.displayMode
    });

    if (!watched || this.#settings.displayMode === "disabled") {
      restoreCard(card.element);
      return;
    }

    this.diagnostics.cardsMatched += 1;
    if (mutateCard(card.element, this.#settings.displayMode)) {
      this.diagnostics.cardsModified += 1;
      this.#logger?.info("watched recommendation modified", {
        videoIds: card.videoIds,
        displayMode: this.#settings.displayMode
      });
    }
  }

  async #isWatched(card: CandidateCard): Promise<boolean> {
    if (
      this.#settings.watchStatusSource === "playtime-or-card-progress" &&
      this.#adapter.hasWatchProgressBar(card.element)
    ) {
      return true;
    }

    for (const videoId of card.videoIds) {
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
  card.classList.toggle("rec-leash-dim", mode === "dim");
  card.classList.toggle("rec-leash-hide", mode === "hide");
  return previousState !== mode;
}

export function restoreCard(card: HTMLElement): void {
  card.removeAttribute(CARD_ATTR);
  card.classList.remove("rec-leash-dim", "rec-leash-hide");
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
