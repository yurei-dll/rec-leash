const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && VIDEO_ID_PATTERN.test(value);
}

export function extractVideoIdFromUrl(input: string, baseUrl = "https://www.youtube.com/"): string | null {
  let url: URL;

  try {
    url = new URL(input, baseUrl);
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }

  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidVideoId(id) ? id : null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return isValidVideoId(id) ? id : null;
  }

  if (url.pathname.startsWith("/shorts/")) {
    return null;
  }

  return null;
}
