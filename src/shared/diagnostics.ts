import { getBrowserApi, type WebExtensionApi } from "./browser-api";
import type { PageDiagnostics, StoredDiagnostics, WatchedVideoRecord } from "./types";

const DIAGNOSTICS_KEY = "recLeashDiagnostics";

export async function getStoredDiagnostics(api: WebExtensionApi = getBrowserApi()): Promise<StoredDiagnostics> {
  const result = await api.storage.local.get(DIAGNOSTICS_KEY);
  const value = result[DIAGNOSTICS_KEY];
  return value && typeof value === "object" ? (value as StoredDiagnostics) : {};
}

export async function saveLastRecordedVideo(
  record: WatchedVideoRecord,
  api: WebExtensionApi = getBrowserApi()
): Promise<void> {
  const current = await getStoredDiagnostics(api);
  await api.storage.local.set({ [DIAGNOSTICS_KEY]: { ...current, lastVideoRecorded: record } });
}

export async function savePageDiagnostics(
  diagnostics: PageDiagnostics,
  api: WebExtensionApi = getBrowserApi()
): Promise<void> {
  const current = await getStoredDiagnostics(api);
  await api.storage.local.set({ [DIAGNOSTICS_KEY]: { ...current, lastPageDiagnostics: diagnostics } });
}
