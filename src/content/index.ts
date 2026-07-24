import { RecommendationCardFilter } from "./card-filter";
import { YouTubeWatchObserver } from "./watch-observer";
import { IndexedDbHistoryStore } from "../shared/history-store";
import { getSettings, normalizeSettings } from "../shared/settings";

async function main(): Promise<void> {
  const store = new IndexedDbHistoryStore();
  const settings = await getSettings();
  const watchObserver = new YouTubeWatchObserver(store);
  const cardFilter = new RecommendationCardFilter(store, settings);

  watchObserver.start();
  cardFilter.start();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.recommendationLeashSettings) {
      return;
    }

    cardFilter.setDisplayMode(normalizeSettings(changes.recommendationLeashSettings.newValue).displayMode);
  });
}

void main();
