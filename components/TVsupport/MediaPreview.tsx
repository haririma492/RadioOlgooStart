"use client";

type Props = {
  url?: string;
  title?: string;
  height?: number;
};

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function MediaPreview({ url, title, height = 180 }: Props) {
  if (!url) {
    return (
      <div style={{
        height,
        borderRadius: 12,
        background: "#0b1220",
        border: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 13,
      }}>
        No preview
      </div>
    );
  }

  const lower = url.toLowerCase();
  const youtubeId = extractYouTubeId(url);

  if (youtubeId) {
    return (
      <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 12, border: "1px solid #334155", background: "#000" }}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=1&rel=0`}
          title={title || "preview"}
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif")) {
    return (
      <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 12, border: "1px solid #334155", background: "#000" }}>
        <img src={url} alt={title || "preview"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 12, border: "1px solid #334155", background: "#000" }}>
      <video
        src={url}
        controls
        preload="metadata"
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
      />
    </div>
  );
}
