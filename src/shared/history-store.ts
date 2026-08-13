import { nowIso } from "./time";
import { getBrowserApi, type WebExtensionApi } from "./browser-api";
import type { HistoryExport, WatchedVideoRecord } from "./types";

export interface HistoryStore {
  upsert(record: WatchedVideoRecord): Promise<WatchedVideoRecord>;
  get(videoId: string): Promise<WatchedVideoRecord | undefined>;
  has(videoId: string): Promise<boolean>;
  count(): Promise<number>;
  list(): Promise<WatchedVideoRecord[]>;
  clear(): Promise<void>;
  importRecords(records: WatchedVideoRecord[]): Promise<number>;
  exportHistory(): Promise<HistoryExport>;
}

const DB_NAME = "rec-leash";
const DB_VERSION = 1;
const STORE_NAME = "watchedVideos";

export const HISTORY_MESSAGE_TYPE = "rec-leash:history";

type HistoryRequest =
  | { type: typeof HISTORY_MESSAGE_TYPE; operation: "upsert"; record: WatchedVideoRecord }
  | { type: typeof HISTORY_MESSAGE_TYPE; operation: "get" | "has"; videoId: string }
  | { type: typeof HISTORY_MESSAGE_TYPE; operation: "count" | "list" | "clear" | "exportHistory" }
  | { type: typeof HISTORY_MESSAGE_TYPE; operation: "importRecords"; records: WatchedVideoRecord[] };

export function mergeWatchedRecord(
  existing: WatchedVideoRecord | undefined,
  incoming: WatchedVideoRecord
): WatchedVideoRecord {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...definedFields(incoming),
    videoId: existing.videoId,
    firstObservedAt: earliestIso(existing.firstObservedAt, incoming.firstObservedAt),
    lastObservedAt: latestIso(existing.lastObservedAt, incoming.lastObservedAt),
    source: incoming.source ?? existing.source
  };
}

export class IndexedDbHistoryStore implements HistoryStore {
  #dbPromise?: Promise<IDBDatabase>;

  async upsert(record: WatchedVideoRecord): Promise<WatchedVideoRecord> {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(record.videoId);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const merged = mergeWatchedRecord(getRequest.result as WatchedVideoRecord | undefined, record);
        const putRequest = store.put(merged);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve(merged);
      };
    });
  }

  async get(videoId: string): Promise<WatchedVideoRecord | undefined> {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(videoId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as WatchedVideoRecord | undefined);
    });
  }

  async has(videoId: string): Promise<boolean> {
    return Boolean(await this.get(videoId));
  }

  async count(): Promise<number> {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async list(): Promise<WatchedVideoRecord[]> {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as WatchedVideoRecord[]);
    });
  }

  async clear(): Promise<void> {
    const db = await this.#db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async importRecords(records: WatchedVideoRecord[]): Promise<number> {
    let imported = 0;
    for (const record of records) {
      await this.upsert(record);
      imported += 1;
    }
    return imported;
  }

  async exportHistory(): Promise<HistoryExport> {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      records: await this.list()
    };
  }

  async #db(): Promise<IDBDatabase> {
    this.#dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "videoId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });

    return this.#dbPromise;
  }
}

/**
 * Routes history access through the extension background page. Content-script
 * IndexedDB belongs to the web page's origin, so opening the database directly
 * there creates a different history from the one visible to extension pages.
 */
export class ExtensionHistoryStore implements HistoryStore {
  #api: WebExtensionApi;

  constructor(api: WebExtensionApi = getBrowserApi()) {
    this.#api = api;
  }

  upsert(record: WatchedVideoRecord): Promise<WatchedVideoRecord> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "upsert", record });
  }

  get(videoId: string): Promise<WatchedVideoRecord | undefined> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "get", videoId });
  }

  has(videoId: string): Promise<boolean> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "has", videoId });
  }

  count(): Promise<number> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "count" });
  }

  list(): Promise<WatchedVideoRecord[]> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "list" });
  }

  clear(): Promise<void> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "clear" });
  }

  importRecords(records: WatchedVideoRecord[]): Promise<number> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "importRecords", records });
  }

  exportHistory(): Promise<HistoryExport> {
    return this.#send({ type: HISTORY_MESSAGE_TYPE, operation: "exportHistory" });
  }

  async #send<T>(request: HistoryRequest): Promise<T> {
    const response = (await this.#api.runtime.sendMessage(request)) as { ok: true; value: T } | { ok: false; error: string };
    if (!response?.ok) {
      throw new Error(response?.error ?? "History service returned no response");
    }
    return response.value;
  }
}

export function isHistoryRequest(value: unknown): value is HistoryRequest {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === HISTORY_MESSAGE_TYPE);
}

export async function handleHistoryRequest(request: HistoryRequest, store: HistoryStore): Promise<unknown> {
  switch (request.operation) {
    case "upsert": return store.upsert(request.record);
    case "get": return store.get(request.videoId);
    case "has": return store.has(request.videoId);
    case "count": return store.count();
    case "list": return store.list();
    case "clear": return store.clear();
    case "importRecords": return store.importRecords(request.records);
    case "exportHistory": return store.exportHistory();
  }
}

export class MemoryHistoryStore implements HistoryStore {
  readonly records = new Map<string, WatchedVideoRecord>();

  async upsert(record: WatchedVideoRecord): Promise<WatchedVideoRecord> {
    const merged = mergeWatchedRecord(this.records.get(record.videoId), record);
    this.records.set(record.videoId, merged);
    return merged;
  }

  async get(videoId: string): Promise<WatchedVideoRecord | undefined> {
    return this.records.get(videoId);
  }

  async has(videoId: string): Promise<boolean> {
    return this.records.has(videoId);
  }

  async count(): Promise<number> {
    return this.records.size;
  }

  async list(): Promise<WatchedVideoRecord[]> {
    return [...this.records.values()];
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async importRecords(records: WatchedVideoRecord[]): Promise<number> {
    for (const record of records) {
      await this.upsert(record);
    }
    return records.length;
  }

  async exportHistory(): Promise<HistoryExport> {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      records: await this.list()
    };
  }
}

function definedFields(record: WatchedVideoRecord): Partial<WatchedVideoRecord> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function earliestIso(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function latestIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}
