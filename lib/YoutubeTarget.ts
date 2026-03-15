export type YouTubeTarget =
  | { kind: "channelId"; channelId: string }
  | { kind: "handle"; handle: string }
  | { kind: "videoId"; videoId: string }
  | { kind: "unknown"; raw: string };

function clean(input: string): string {
  return String(input ?? "").trim();
}

function normalizeHandle(value: string): string {
  return value.replace(/^@/, "").trim();
}

export function parseYouTubeTarget(input: string): YouTubeTarget {
  const raw = clean(input);

  if (!raw) {
    return { kind: "unknown", raw };
  }

  const s = raw.replace(/\s+/g, "");

  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(s)) {
    return { kind: "channelId", channelId: s };
  }

  if (/^@?[A-Za-z0-9._-]+$/.test(s) && !/[/:?&=]/.test(s)) {
    return { kind: "handle", handle: normalizeHandle(s) };
  }

  try {
    const url = s.startsWith("http://") || s.startsWith("https://")
      ? new URL(s)
      : new URL(`https://${s}`);

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname;

    if (host === "youtu.be") {
      const maybeVideoId = path.replace(/^\/+/, "").split("/")[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(maybeVideoId)) {
        return { kind: "videoId", videoId: maybeVideoId };
      }
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return { kind: "videoId", videoId: v };
      }

      const segments = path.split("/").filter(Boolean);

      if (segments.length >= 1 && segments[0].startsWith("@")) {
        const handle = normalizeHandle(segments[0]);
        if (handle) {
          return { kind: "handle", handle };
        }
      }

      if (segments.length >= 2 && segments[0].toLowerCase() === "channel") {
        const channelId = segments[1];
        if (/^UC[a-zA-Z0-9_-]{20,}$/.test(channelId)) {
          return { kind: "channelId", channelId };
        }
      }

      if (segments.length >= 2 && segments[0].toLowerCase() === "embed") {
        const maybeVideoId = segments[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(maybeVideoId)) {
          return { kind: "videoId", videoId: maybeVideoId };
        }
      }

      if (segments.length >= 2 && segments[0].toLowerCase() === "live" && segments[1]) {
        const maybeVideoId = segments[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(maybeVideoId)) {
          return { kind: "videoId", videoId: maybeVideoId };
        }
      }

      if (segments.length >= 2 && ["c", "user"].includes(segments[0].toLowerCase())) {
        const handle = normalizeHandle(segments[1]);
        if (handle) {
          return { kind: "handle", handle };
        }
      }
    }
  } catch {
    const watchMatch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch?.[1]) {
      return { kind: "videoId", videoId: watchMatch[1] };
    }

    const shortMatch = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch?.[1]) {
      return { kind: "videoId", videoId: shortMatch[1] };
    }

    const handleUrlMatch = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
    if (handleUrlMatch?.[1]) {
      return { kind: "handle", handle: normalizeHandle(handleUrlMatch[1]) };
    }

    const channelMatch = s.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/i);
    if (channelMatch?.[1]) {
      return { kind: "channelId", channelId: channelMatch[1] };
    }
  }

  return { kind: "unknown", raw };
}