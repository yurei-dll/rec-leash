export type WatchedSource = "watch-page" | "import" | "manual";

export interface WatchedVideoRecord {
  videoId: string;
  firstObservedAt: string;
  lastObservedAt: string;
  title?: string;
  channel?: string;
  source: WatchedSource;
  playbackProgressSeconds?: number;
}

export type DisplayMode = "badge" | "dim" | "hide" | "disabled";

export interface ExtensionSettings {
  displayMode: DisplayMode;
  debugLogging: boolean;
}

export interface PageDiagnostics {
  cardsScanned: number;
  cardsMatched: number;
  cardsModified: number;
}

export interface StoredDiagnostics {
  lastVideoRecorded?: WatchedVideoRecord;
  lastPageDiagnostics?: PageDiagnostics;
}

export interface HistoryExport {
  schemaVersion: 1;
  exportedAt: string;
  records: WatchedVideoRecord[];
}
