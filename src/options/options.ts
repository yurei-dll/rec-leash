import { getStoredDiagnostics } from "../shared/diagnostics";
import { IndexedDbHistoryStore } from "../shared/history-store";
import { JsonHistoryImporter, stringifyHistoryExport } from "../shared/import-export";
import { getSettings, saveSettings } from "../shared/settings";
import type { DisplayMode, WatchStatusSource } from "../shared/types";

const store = new IndexedDbHistoryStore();
const importer = new JsonHistoryImporter();

const elements = {
  displayMode: document.querySelector<HTMLSelectElement>("#display-mode"),
  watchStatusSource: document.querySelector<HTMLSelectElement>("#watch-status-source"),
  debugLogging: document.querySelector<HTMLInputElement>("#debug-logging"),
  recordCount: document.querySelector<HTMLElement>("#record-count"),
  cardsScanned: document.querySelector<HTMLElement>("#cards-scanned"),
  cardsMatched: document.querySelector<HTMLElement>("#cards-matched"),
  cardsModified: document.querySelector<HTMLElement>("#cards-modified"),
  lastRecorded: document.querySelector<HTMLElement>("#last-recorded"),
  exportHistory: document.querySelector<HTMLButtonElement>("#export-history"),
  importHistory: document.querySelector<HTMLInputElement>("#import-history"),
  clearHistory: document.querySelector<HTMLButtonElement>("#clear-history"),
  status: document.querySelector<HTMLElement>("#status")
};

void init();

async function init(): Promise<void> {
  const settings = await getSettings();
  required(elements.displayMode).value = settings.displayMode;
  required(elements.watchStatusSource).value = settings.watchStatusSource;
  required(elements.debugLogging).checked = settings.debugLogging;
  await refresh();

  required(elements.displayMode).addEventListener("change", () => {
    void saveCurrentSettings().then(() => {
      setStatus("Display mode saved.");
    });
  });

  required(elements.watchStatusSource).addEventListener("change", () => {
    void saveCurrentSettings().then(() => {
      setStatus("Watch-status source saved.");
    });
  });

  required(elements.debugLogging).addEventListener("change", () => {
    void saveCurrentSettings().then(() => {
      setStatus(`Verbose logging ${required(elements.debugLogging).checked ? "enabled" : "disabled"}.`);
    });
  });

  required(elements.exportHistory).addEventListener("click", () => {
    void exportHistory();
  });

  required(elements.importHistory).addEventListener("change", () => {
    void importHistory();
  });

  required(elements.clearHistory).addEventListener("click", () => {
    void clearHistory();
  });
}

function saveCurrentSettings(): Promise<unknown> {
  return saveSettings({
    displayMode: required(elements.displayMode).value as DisplayMode,
    watchStatusSource: required(elements.watchStatusSource).value as WatchStatusSource,
    debugLogging: required(elements.debugLogging).checked
  });
}

async function refresh(): Promise<void> {
  const count = await store.count();
  const diagnostics = await getStoredDiagnostics();

  setText(elements.recordCount, String(count));
  setText(elements.cardsScanned, String(diagnostics.lastPageDiagnostics?.cardsScanned ?? 0));
  setText(elements.cardsMatched, String(diagnostics.lastPageDiagnostics?.cardsMatched ?? 0));
  setText(elements.cardsModified, String(diagnostics.lastPageDiagnostics?.cardsModified ?? 0));

  const last = diagnostics.lastVideoRecorded;
  setText(
    elements.lastRecorded,
    last
      ? `Last recorded: ${last.title ?? last.videoId} (${last.videoId}) at ${last.lastObservedAt}`
      : "No videos recorded yet."
  );
}

async function exportHistory(): Promise<void> {
  const blob = new Blob([stringifyHistoryExport(await store.exportHistory())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rec-leash-history-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Export prepared.");
}

async function importHistory(): Promise<void> {
  const file = required(elements.importHistory).files?.[0];
  if (!file) {
    return;
  }

  const records = importer.parse(await file.text());
  const imported = await store.importRecords(records);
  required(elements.importHistory).value = "";
  await refresh();
  setStatus(`Imported ${imported} records.`);
}

async function clearHistory(): Promise<void> {
  if (!window.confirm("Clear all local rec-leash watched-video history? This cannot be undone.")) {
    return;
  }

  await store.clear();
  await refresh();
  setStatus("Local watched history cleared.");
}

function required<T>(value: T | null): T {
  if (!value) {
    throw new Error("Options UI is missing an expected element.");
  }
  return value;
}

function setText(element: HTMLElement | null, text: string): void {
  required(element).textContent = text;
}

function setStatus(text: string): void {
  setText(elements.status, text);
}
