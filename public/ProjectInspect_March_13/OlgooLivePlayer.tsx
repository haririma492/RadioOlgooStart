"use client";

type OlgooLivePlayerProps = {
  mediaUrl: string;
  title?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
};

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

function isHls(url: string): boolean {
  return /\.m3u8($|\?)/i.test(url);
}

function isAudio(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg)($|\?)/i.test(url);
}

function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|ogv)($|\?)/i.test(url);
}

export default function OlgooLivePlayer({
  mediaUrl,
  title = "Olgoo Live",
  autoPlay = true,
  controls = true,
  muted = false,
  className = "",
}: OlgooLivePlayerProps) {
  const safeUrl = (mediaUrl || "").trim();
  const ytId = extractYoutubeId(safeUrl);

  if (!safeUrl) {
    return (
      <div
        className={`flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-black text-white/70 ${className}`}
      >
        No live media URL provided.
      </div>
    );
  }

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}&playsinline=1&rel=0`}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : isImage(safeUrl) ? (
        <img
          src={safeUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : isHls(safeUrl) || isVideo(safeUrl) ? (
        <video
          src={safeUrl}
          title={title}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={autoPlay}
          controls={controls}
          muted={muted}
          playsInline
        />
      ) : isAudio(safeUrl) ? (
        <div className="flex h-full w-full items-center justify-center bg-black px-6">
          <audio
            src={safeUrl}
            autoPlay={autoPlay}
            controls={controls}
            className="w-full"
          />
        </div>
      ) : (
        <iframe
          src={safeUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      )}

      <img
        src="/images/logo-circular.png"
        alt="Olgoo logo"
        className="pointer-events-none absolute bottom-3 left-3 z-20 w-14 opacity-95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] md:bottom-4 md:left-4 md:w-20"
      />
    </div>
  );
}