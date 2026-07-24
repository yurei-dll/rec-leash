export interface PlaybackThresholdOptions {
  thresholdSeconds: number;
  nowMs?: () => number;
}

export class PlaybackThresholdTracker {
  readonly thresholdSeconds: number;
  #nowMs: () => number;
  #currentVideoId: string | undefined;
  #playingSinceMs: number | undefined;
  #accumulatedMs = 0;
  #recorded = false;

  constructor(options: PlaybackThresholdOptions) {
    this.thresholdSeconds = options.thresholdSeconds;
    this.#nowMs = options.nowMs ?? (() => Date.now());
  }

  switchVideo(videoId: string | null): void {
    if (this.#currentVideoId === videoId) {
      return;
    }

    this.#currentVideoId = videoId === null ? undefined : videoId;
    this.#playingSinceMs = undefined;
    this.#accumulatedMs = 0;
    this.#recorded = false;
  }

  onPlay(): boolean {
    if (!this.#currentVideoId || this.#recorded || this.#playingSinceMs !== undefined) {
      return false;
    }

    this.#playingSinceMs = this.#nowMs();
    return this.#isReady();
  }

  onPauseOrStop(): boolean {
    this.#flushPlayingTime();
    return this.#isReady();
  }

  tick(): boolean {
    this.#flushPlayingTime(true);
    return this.#isReady();
  }

  markRecorded(): void {
    this.#recorded = true;
  }

  get progressSeconds(): number {
    return Math.floor(this.#currentProgressMs() / 1000);
  }

  #isReady(): boolean {
    return Boolean(this.#currentVideoId && !this.#recorded && this.#currentProgressMs() >= this.thresholdSeconds * 1000);
  }

  #currentProgressMs(): number {
    const liveMs = this.#playingSinceMs === undefined ? 0 : this.#nowMs() - this.#playingSinceMs;
    return this.#accumulatedMs + Math.max(0, liveMs);
  }

  #flushPlayingTime(continuePlaying = false): void {
    if (this.#playingSinceMs === undefined) {
      return;
    }

    const now = this.#nowMs();
    this.#accumulatedMs += Math.max(0, now - this.#playingSinceMs);
    if (continuePlaying) {
      this.#playingSinceMs = now;
    } else {
      this.#playingSinceMs = undefined;
    }
  }
}
