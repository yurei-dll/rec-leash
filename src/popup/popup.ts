import { getSettings, saveSettings } from "../shared/settings";
import type { DisplayMode, WatchStatusSource } from "../shared/types";

const elements = {
  form: document.querySelector<HTMLFormElement>("#settings-form"),
  fields: document.querySelector<HTMLFieldSetElement>("#settings-fields"),
  displayMode: document.querySelector<HTMLSelectElement>("#display-mode"),
  watchStatusSource: document.querySelector<HTMLSelectElement>("#watch-status-source"),
  showUnwatchedChip: document.querySelector<HTMLInputElement>("#show-unwatched-chip"),
  debugLogging: document.querySelector<HTMLInputElement>("#debug-logging"),
  saveButton: document.querySelector<HTMLButtonElement>("#save-settings"),
  status: document.querySelector<HTMLElement>("#status")
};

void init();

async function init(): Promise<void> {
  required(elements.form).addEventListener("submit", (event) => {
    event.preventDefault();
    void saveCurrentSettings();
  });

  const status = required(elements.status);
  try {
    const settings = await getSettings();
    required(elements.displayMode).value = settings.displayMode;
    required(elements.watchStatusSource).value = settings.watchStatusSource;
    required(elements.showUnwatchedChip).checked = settings.showUnwatchedChip;
    required(elements.debugLogging).checked = settings.debugLogging;
    required(elements.fields).disabled = false;
    status.textContent = "";
  } catch (error) {
    status.dataset.error = "true";
    status.textContent = `Could not load settings: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function saveCurrentSettings(): Promise<void> {
  const button = required(elements.saveButton);
  const status = required(elements.status);
  button.disabled = true;
  status.dataset.error = "false";
  status.textContent = "Saving…";

  try {
    await saveSettings({
      displayMode: required(elements.displayMode).value as DisplayMode,
      watchStatusSource: required(elements.watchStatusSource).value as WatchStatusSource,
      showUnwatchedChip: required(elements.showUnwatchedChip).checked,
      debugLogging: required(elements.debugLogging).checked
    });
    status.textContent = "Settings saved.";
  } catch (error) {
    status.dataset.error = "true";
    status.textContent = `Could not save settings: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    button.disabled = false;
  }
}

function required<T>(value: T | null): T {
  if (!value) {
    throw new Error("Popup UI is missing an expected element.");
  }
  return value;
}
