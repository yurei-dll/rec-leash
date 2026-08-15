import type { Logger } from "../shared/logger";

const CHIP_CLASS = "rec-leash-unwatched-chip";
const FILTERED_CLASS = "rec-leash-unwatched-filtered";
const CHIP_SELECTOR = "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer";

export class UnwatchedChipController {
  #enabled: boolean;
  #active = false;
  #observer?: MutationObserver;
  #logger: Logger | undefined;

  constructor(enabled: boolean, logger?: Logger) {
    this.#enabled = enabled;
    this.#logger = logger;
  }

  start(): void {
    this.#observer = new MutationObserver((mutations) => {
      if (!this.#enabled) return;
      const needsChip = mutations.some((mutation) => mutation.type === "childList");
      const watchedStateChanged = mutations.some(
        (mutation) => mutation.type === "attributes" && mutation.attributeName === "data-rec-leash-watched"
      );
      if (needsChip) this.#ensureChip();
      if (this.#active && (needsChip || watchedStateChanged)) this.#applyFilter();
    });
    this.#observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-rec-leash-watched"]
    });
    document.addEventListener("click", this.#handleDocumentClick);
    if (this.#enabled) this.#ensureChip();
  }

  stop(): void {
    this.#observer?.disconnect();
    document.removeEventListener("click", this.#handleDocumentClick);
    this.#removeChip();
    this.#setActive(false);
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.#enabled) return;
    this.#enabled = enabled;
    if (enabled) {
      this.#ensureChip();
      return;
    }
    this.#removeChip();
    this.#setActive(false);
  }

  #ensureChip(): void {
    if (!this.#enabled || document.querySelector(`.${CHIP_CLASS}`)) return;
    const allChip = Array.from(document.querySelectorAll<HTMLElement>(CHIP_SELECTOR)).find(
      (chip) => chip.textContent?.trim() === "All"
    );
    if (!allChip?.parentElement) return;

    const chip = document.createElement("yt-chip-cloud-chip-renderer");
    chip.className = `${CHIP_CLASS} style-scope ytd-feed-filter-chip-bar-renderer`;
    chip.textContent = "Unwatched";
    chip.setAttribute("chip-style", "STYLE_HOME_FILTER");
    chip.setAttribute("role", "tab");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("aria-selected", "false");
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#setActive(!this.#active);
    });
    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.#setActive(!this.#active);
    });
    allChip.after(chip);
    this.#syncChipSelection();
    this.#logger?.info("Unwatched chip added");
  }

  #handleDocumentClick = (event: Event): void => {
    if (!this.#active || !(event.target instanceof Element)) return;
    const nativeChip = event.target.closest(CHIP_SELECTOR);
    if (nativeChip && !nativeChip.classList.contains(CHIP_CLASS)) this.#setActive(false);
  };

  #setActive(active: boolean): void {
    this.#active = active;
    this.#syncChipSelection();
    this.#applyFilter();
    this.#logger?.info("Unwatched filter changed", { active });
  }

  #syncChipSelection(): void {
    const chip = document.querySelector<HTMLElement>(`.${CHIP_CLASS}`);
    chip?.classList.toggle("iron-selected", this.#active);
    chip?.toggleAttribute("selected", this.#active);
    chip?.setAttribute("aria-selected", String(this.#active));
  }

  #applyFilter(): void {
    document.querySelectorAll<HTMLElement>("[data-rec-leash-watched]").forEach((card) => {
      card.classList.toggle(FILTERED_CLASS, this.#active && card.dataset.recLeashWatched === "true");
    });
    if (!this.#active) {
      document.querySelectorAll<HTMLElement>(`.${FILTERED_CLASS}`).forEach((card) => card.classList.remove(FILTERED_CLASS));
    }
  }

  #removeChip(): void {
    document.querySelectorAll(`.${CHIP_CLASS}`).forEach((chip) => chip.remove());
  }
}
