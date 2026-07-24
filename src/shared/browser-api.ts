type RuntimeApi = Pick<typeof browser.runtime, "sendMessage" | "onMessage">;
type StorageApi = typeof browser.storage;

export interface WebExtensionApi {
  runtime: RuntimeApi;
  storage: StorageApi;
}

export function getBrowserApi(): WebExtensionApi {
  const globalWithApis = globalThis as typeof globalThis & {
    browser?: WebExtensionApi;
    chrome?: WebExtensionApi;
  };

  const api = globalWithApis.browser ?? globalWithApis.chrome;
  if (!api) {
    throw new Error("WebExtension browser API is unavailable");
  }

  return api;
}
