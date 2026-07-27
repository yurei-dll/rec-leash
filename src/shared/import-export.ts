import type { HistoryExport, WatchedVideoRecord } from "./types";
import { isValidVideoId } from "./video-id";

export interface HistoryImporter {
  parse(input: string): WatchedVideoRecord[];
}

export class JsonHistoryImporter implements HistoryImporter {
  parse(input: string): WatchedVideoRecord[] {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Import file must be a rec-leash JSON export.");
    }

    const records = (parsed as Partial<HistoryExport>).records;
    if (!Array.isArray(records)) {
      throw new Error("Import JSON must include a records array.");
    }

    return records.map(validateRecord);
  }
}

export interface TakeoutImporterPlan extends HistoryImporter {
  readonly formatName: "google-takeout-youtube-history";
}

export class RepresentativeTakeoutImporter implements TakeoutImporterPlan {
  readonly formatName = "google-takeout-youtube-history" as const;

  parse(input: string): WatchedVideoRecord[] {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Expected a JSON array from a representative YouTube Takeout fixture.");
    }

    const records: WatchedVideoRecord[] = [];

    for (const entry of parsed) {
        if (!entry || typeof entry !== "object") {
        continue;
        }

        const item = entry as {
          titleUrl?: string;
          title?: string;
          subtitles?: Array<{ name?: string }>;
          time?: string;
        };
        const videoId = item.titleUrl ? new URL(item.titleUrl).searchParams.get("v") : null;
        if (!isValidVideoId(videoId)) {
        continue;
        }

        const observedAt = item.time ?? new Date(0).toISOString();
      const title = normalizeTakeoutTitle(item.title);
      const channel = item.subtitles?.[0]?.name;
      records.push({
          videoId,
          firstObservedAt: observedAt,
          lastObservedAt: observedAt,
        ...(title ? { title } : {}),
        ...(channel ? { channel } : {}),
          source: "import" as const
      });
    }

    return records;
  }
}

export function stringifyHistoryExport(exportData: HistoryExport): string {
  return `${JSON.stringify(exportData, null, 2)}\n`;
}

function validateRecord(record: unknown): WatchedVideoRecord {
  if (!record || typeof record !== "object") {
    throw new Error("Each imported record must be an object.");
  }

  const candidate = record as Partial<WatchedVideoRecord>;
  if (!isValidVideoId(candidate.videoId)) {
    throw new Error("Imported record has an invalid video ID.");
  }

  if (!candidate.firstObservedAt || !candidate.lastObservedAt) {
    throw new Error("Imported record is missing timestamps.");
  }

  return {
    videoId: candidate.videoId,
    firstObservedAt: candidate.firstObservedAt,
    lastObservedAt: candidate.lastObservedAt,
    ...(candidate.title ? { title: candidate.title } : {}),
    ...(candidate.channel ? { channel: candidate.channel } : {}),
    source: candidate.source ?? "import",
    ...(candidate.playbackProgressSeconds !== undefined
      ? { playbackProgressSeconds: candidate.playbackProgressSeconds }
      : {})
  };
}

function normalizeTakeoutTitle(title: string | undefined): string | undefined {
  return title?.replace(/^Watched\s+/, "") || undefined;
}
