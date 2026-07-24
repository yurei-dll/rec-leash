import { saveLastRecordedVideo } from "../shared/diagnostics";
import type { HistoryStore } from "../shared/history-store";
import type { Logger } from "../shared/logger";
import { nowIso } from "../shared/time";
import { extractVideoIdFromUrl } from "../shared/video-id";
import { PlaybackThresholdTracker } from "./watch-threshold";

const WATCH_THRESHOLD_SECONDS = 30;

export class YouTubeWatchObserver {
  #store: HistoryStore;
  #logger: Logger;
  #tracker = new PlaybackThresholdTracker({ thresholdSeconds: WATCH_THRESHOLD_SECONDS });
  #intervalId: number | undefined;
  #lastHref = "";
  #videoElement: HTMLVideoElement | undefined;

  constructor(store: HistoryStore, logger: Logger) {
    this.#store = store;
    this.#logger = logger;
  }

  start(): void {
    this.#logger.info("watch observer started", { thresholdSeconds: WATCH_THRESHOLD_SECONDS });
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
    this.#logger.info("watch observer stopped");
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
    this.#logger.debug("navigation observed", { href: window.location.href, videoId });
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
      this.#logger.debug("no video element found on current page");
      return;
    }

    this.#videoElement = video;
    this.#logger.debug("attached playback listeners", {
      paused: video.paused,
      ended: video.ended,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : undefined
    });
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

    this.#logger.debug("detached playback listeners");
    this.#videoElement.removeEventListener("playing", this.#onPlaying);
    this.#videoElement.removeEventListener("pause", this.#onPause);
    this.#videoElement.removeEventListener("ended", this.#onPause);
    this.#videoElement = undefined;
  }

  #onPlaying = (): void => {
    this.#logger.debug("playback started or resumed", { progressSeconds: this.#tracker.progressSeconds });
    if (this.#tracker.onPlay()) {
      void this.#recordIfReady();
    }
  };

  #onPause = (): void => {
    this.#logger.debug("playback paused or ended", { progressSeconds: this.#tracker.progressSeconds });
    if (this.#tracker.onPauseOrStop()) {
      void this.#recordIfReady();
    }
  };

  async #recordIfReady(): Promise<void> {
    if (!this.#tracker.tick()) {
      this.#logger.debug("watch threshold not reached", {
        progressSeconds: this.#tracker.progressSeconds,
        thresholdSeconds: WATCH_THRESHOLD_SECONDS
      });
      return;
    }

    const videoId = extractVideoIdFromUrl(window.location.href);
    if (!videoId) {
      this.#logger.debug("threshold reached but current URL is not a normal watch URL", {
        href: window.location.href
      });
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
    this.#logger.info("watched video recorded", record);
  }
}
