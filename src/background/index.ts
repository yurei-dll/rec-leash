import { handleHistoryRequest, IndexedDbHistoryStore, isHistoryRequest } from "../shared/history-store";

const store = new IndexedDbHistoryStore();

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isHistoryRequest(message)) {
    return undefined;
  }

  return handleHistoryRequest(message, store).then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) })
  );
});
