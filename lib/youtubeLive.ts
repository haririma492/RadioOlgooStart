// lib/youtubeLive.ts

export type LiveItem = {
  handle: string;
  videoId: string;
  watchUrl: string;
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

export function youtubeThumbUrl(videoId: string) {
  // maxresdefault may not always exist; UI can fall back to hqdefault if needed
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}