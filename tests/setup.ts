import "fake-indexeddb/auto";
import { vi } from "vitest";

const storageState = new Map<string, unknown>();

Object.defineProperty(globalThis, "browser", {
  value: {
    storage: {
      local: {
        async get(key?: string) {
          if (!key) {
            return Object.fromEntries(storageState);
          }
          if (typeof key === "string") {
            return { [key]: storageState.get(key) };
          }
          return {};
        },
        async set(values: Record<string, unknown>) {
          Object.entries(values).forEach(([key, value]) => storageState.set(key, value));
        },
        async clear() {
          storageState.clear();
        }
      },
      onChanged: {
        addListener: vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    }
  },
  writable: true
});
