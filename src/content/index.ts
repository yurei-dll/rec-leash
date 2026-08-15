import { RecommendationCardFilter } from "./card-filter";
import { YouTubeWatchObserver } from "./watch-observer";
import { ExtensionHistoryStore, IndexedDbHistoryStore } from "../shared/history-store";
import { Logger } from "../shared/logger";
import { getSettings, normalizeSettings, SETTINGS_KEY } from "../shared/settings";
import { UnwatchedChipController } from "./unwatched-filter";

async function main(): Promise<void> {
  const store = new ExtensionHistoryStore();
  await migratePageOriginHistory(store);
  const settings = await getSettings();
  const logger = new Logger(settings.debugLogging);
  const watchObserver = new YouTubeWatchObserver(store, logger);
  const cardFilter = new RecommendationCardFilter(store, settings, undefined, logger);
  const unwatchedFilter = new UnwatchedChipController(settings.showUnwatchedChip, logger);

  logger.info("content script loaded", {
    href: window.location.href,
    displayMode: settings.displayMode,
    debugLogging: settings.debugLogging
  });
  watchObserver.start();
  cardFilter.start();
  unwatchedFilter.start();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SETTINGS_KEY]) {
      return;
    }

    const nextSettings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    logger.setEnabled(nextSettings.debugLogging);
    logger.info("settings changed", nextSettings);
    cardFilter.setDisplayMode(nextSettings.displayMode);
    cardFilter.setWatchStatusSource(nextSettings.watchStatusSource);
    unwatchedFilter.setEnabled(nextSettings.showUnwatchedChip);
  });
}

async function migratePageOriginHistory(store: ExtensionHistoryStore): Promise<void> {
  const migrationKey = `recLeashHistoryMigrated:${window.location.hostname}`;
  const state = await browser.storage.local.get(migrationKey);
  if (state[migrationKey] === true) {
    return;
  }

  const legacyRecords = await new IndexedDbHistoryStore().list();
  if (legacyRecords.length > 0) {
    await store.importRecords(legacyRecords);
  }
  await browser.storage.local.set({ [migrationKey]: true });
}

void main().catch((error: unknown) => {
  console.error("[rec-leash] content script failed to start", error);
});
