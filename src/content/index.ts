import { RecommendationCardFilter } from "./card-filter";
import { YouTubeWatchObserver } from "./watch-observer";
import { IndexedDbHistoryStore } from "../shared/history-store";
import { Logger } from "../shared/logger";
import { getSettings, normalizeSettings, SETTINGS_KEY } from "../shared/settings";

async function main(): Promise<void> {
  const store = new IndexedDbHistoryStore();
  const settings = await getSettings();
  const logger = new Logger(settings.debugLogging);
  const watchObserver = new YouTubeWatchObserver(store, logger);
  const cardFilter = new RecommendationCardFilter(store, settings, undefined, logger);

  logger.info("content script loaded", {
    href: window.location.href,
    displayMode: settings.displayMode,
    debugLogging: settings.debugLogging
  });
  watchObserver.start();
  cardFilter.start();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SETTINGS_KEY]) {
      return;
    }

    const nextSettings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    logger.setEnabled(nextSettings.debugLogging);
    logger.info("settings changed", nextSettings);
    cardFilter.setDisplayMode(nextSettings.displayMode);
    cardFilter.setWatchStatusSource(nextSettings.watchStatusSource);
  });
}

void main().catch((error: unknown) => {
  console.error("[rec-leash] content script failed to start", error);
});
