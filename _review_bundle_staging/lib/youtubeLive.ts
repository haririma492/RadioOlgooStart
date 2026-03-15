// lib/youtubeLive.ts

export type LiveItem = {
  handle: string;
  videoId: string;
  watchUrl: string;
  /** When set, use for iframe src instead of embed/videoId (e.g. channel live_stream URL) */
  embedUrl?: string;
  title?: string;
  thumbnailUrl?: string;
};

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string, opts?: { autoplay?: boolean; mute?: boolean }) {
  const autoplay = opts?.autoplay ? "1" : "0";
  const mute = opts?.mute ? "1" : "0";
  const params = new URLSearchParams({
    autoplay,
    mute,
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });

  // Note: enablejsapi=0 to keep it simple; we remount iframe to toggle mute.
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Append autoplay/mute to an existing embed URL (e.g. live_stream?channel=UCxxx) */
export function appendEmbedParams(embedUrl: string, opts?: { autoplay?: boolean; mute?: boolean }) {
  const autoplay = opts?.autoplay ? "1" : "0";
  const mute = opts?.mute ? "1" : "0";
  const u = new URL(embedUrl);
  u.searchParams.set("autoplay", autoplay);
  u.searchParams.set("mute", mute);
  u.searchParams.set("playsinline", "1");
  return u.toString();
}

export function youtubeThumbUrl(videoId: string) {
  // maxresdefault may not always exist; UI can fall back to hqdefault if needed
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}