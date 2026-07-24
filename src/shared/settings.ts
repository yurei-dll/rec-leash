import { getBrowserApi, type WebExtensionApi } from "./browser-api";
import type { DisplayMode, ExtensionSettings } from "./types";

export const SETTINGS_KEY = "recommendationLeashSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  displayMode: "badge",
  debugLogging: true
};

const DISPLAY_MODES = new Set<DisplayMode>(["badge", "dim", "hide", "disabled"]);

export async function getSettings(api: WebExtensionApi = getBrowserApi()): Promise<ExtensionSettings> {
  const result = await api.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>,
  api: WebExtensionApi = getBrowserApi()
): Promise<ExtensionSettings> {
  const normalized = normalizeSettings({ ...DEFAULT_SETTINGS, ...settings });
  await api.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const mode = (value as Partial<ExtensionSettings>).displayMode;
  const debugLogging = (value as Partial<ExtensionSettings>).debugLogging;
  return {
    displayMode: DISPLAY_MODES.has(mode as DisplayMode) ? (mode as DisplayMode) : DEFAULT_SETTINGS.displayMode,
    debugLogging: typeof debugLogging === "boolean" ? debugLogging : DEFAULT_SETTINGS.debugLogging
  };
}
