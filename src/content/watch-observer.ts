import { saveLastRecordedVideo } from "../shared/diagnostics";
import type { HistoryStore } from "../shared/history-store";
import { nowIso } from "../shared/time";
import { extractVideoIdFromUrl } from "../shared/video-id";
import { PlaybackThresholdTracker } from "./watch-threshold";

const WATCH_THRESHOLD_SECONDS = 30;

export class YouTubeWatchObserver {
  #store: HistoryStore;
  #tracker = new PlaybackThresholdTracker({ thresholdSeconds: WATCH_THRESHOLD_SECONDS });
  #intervalId: number | undefined;
  #lastHref = "";
  #videoElement: HTMLVideoElement | undefined;

  constructor(store: HistoryStore) {
    this.#store = store;
  }

  start(): void {
    this.#handleNavigation();
    document.addEventListener("yt-navigate-finish", this.#handleNavigation);
    window.addEventListener("popstate", this.#handleNavigation);
    this.#intervalId = window.setInterval(() => {
      if (this.#lastHref !== window.location.href) {
        this.#handleNavigation();
      }
      void this.#recordIfReady();
    }, 1000);
  }

  stop(): void {
    document.removeEventListener("yt-navigate-finish", this.#handleNavigation);
    window.removeEventListener("popstate", this.#handleNavigation);
    if (this.#intervalId !== undefined) {
      window.clearInterval(this.#intervalId);
    }
    this.#detachVideo();
  }

  #handleNavigation = (): void => {
    this.#lastHref = window.location.href;
    const videoId = extractVideoIdFromUrl(window.location.href);
    this.#tracker.switchVideo(videoId);
    this.#attachVideo();
  };

  #attachVideo(): void {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (video === this.#videoElement) {
      return;
    }

    this.#detachVideo();
    if (!video) {
      return;
    }

    this.#videoElement = video;
    video.addEventListener("playing", this.#onPlaying);
    video.addEventListener("pause", this.#onPause);
    video.addEventListener("ended", this.#onPause);
    if (!video.paused && !video.ended) {
      this.#onPlaying();
    }
  }

  #detachVideo(): void {
    if (!this.#videoElement) {
      return;
    }

    this.#videoElement.removeEventListener("playing", this.#onPlaying);
    this.#videoElement.removeEventListener("pause", this.#onPause);
    this.#videoElement.removeEventListener("ended", this.#onPause);
    this.#videoElement = undefined;
  }

  #onPlaying = (): void => {
    if (this.#tracker.onPlay()) {
      void this.#recordIfReady();
    }
  };

  #onPause = (): void => {
    if (this.#tracker.onPauseOrStop()) {
      void this.#recordIfReady();
    }
  };

  async #recordIfReady(): Promise<void> {
    if (!this.#tracker.tick()) {
      return;
    }

    const videoId = extractVideoIdFromUrl(window.location.href);
    if (!videoId) {
      return;
    }

    const observedAt = nowIso();
    const title = document.querySelector("h1 yt-formatted-string, h1")?.textContent?.trim() || undefined;
    const channel =
      document.querySelector("#owner #channel-name a, ytd-video-owner-renderer a")?.textContent?.trim() || undefined;
    const record = await this.#store.upsert({
      videoId,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      ...(title ? { title } : {}),
      ...(channel ? { channel } : {}),
      source: "watch-page",
      playbackProgressSeconds: this.#tracker.progressSeconds
    });
    this.#tracker.markRecorded();
    await saveLastRecordedVideo(record);
  }
}
