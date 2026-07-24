import { nowIso } from "./time";
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

const DB_NAME = "recommendation-leash";
const DB_VERSION = 1;
const STORE_NAME = "watchedVideos";

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
