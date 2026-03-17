"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OlgooLivePlayerType } from "./types";

type OlgooLivePlayerProps = {
  mediaUrl: string;
  title?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  startAtSec?: number;
  liveSync?: boolean;
  playerType?: OlgooLivePlayerType;
};

type CanonicalStateResponse = {
  currentItem?: {
    url?: string;
  } | null;
  mediaUrl?: string;
  offsetSec?: number;
};

function detectPlayerType(url: string, hinted?: OlgooLivePlayerType): OlgooLivePlayerType {
  if (hinted === "iframe") return "iframe";
  const lower = (url || "").toLowerCase();
  if (/youtube\.com|youtu\.be/.test(lower)) return "iframe";
  return "video";
}

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

function clampSeek(el: HTMLMediaElement, targetSec: number) {
  const target = Math.max(0, Math.floor(Number(targetSec || 0)));
  if (!Number.isFinite(target)) return;

  try {
    const duration = Number.isFinite(el.duration) ? el.duration : NaN;
    el.currentTime = Number.isFinite(duration) && duration > 0
      ? Math.min(target, Math.max(0, duration - 0.25))
      : target;
  } catch {
    // ignore seek errors for streams that do not expose duration
  }
}

export default function OlgooLivePlayer({
  mediaUrl,
  title = "Olgoo Live",
  autoPlay = true,
  controls = false,
  muted = true,
  className = "",
  startAtSec = 0,
  liveSync = true,
  playerType,
}: OlgooLivePlayerProps) {
  const safeUrl = (mediaUrl || "").trim();
  const resolvedPlayerType = useMemo(
    () => detectPlayerType(safeUrl, playerType),
    [safeUrl, playerType]
  );
  const ytId = extractYoutubeId(safeUrl);

  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const resyncingRef = useRef(false);
  const allowPauseRef = useRef(false);
  const [isMuted, setIsMuted] = useState(muted);

  useEffect(() => {
    return () => {
      allowPauseRef.current = true;

      const media = mediaRef.current;
      if (media) {
        try {
          media.pause();
        } catch {
          // ignore
        }

        try {
          media.removeAttribute("src");
          media.load();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const onLoadedMetadata = () => {
      clampSeek(media, startAtSec);
    };

    const onPause = () => {
      if (allowPauseRef.current) return;
      void media.play().catch(() => undefined);
    };

    media.addEventListener("loadedmetadata", onLoadedMetadata);
    media.addEventListener("pause", onPause);

    return () => {
      media.removeEventListener("loadedmetadata", onLoadedMetadata);
      media.removeEventListener("pause", onPause);
    };
  }, [safeUrl, startAtSec]);

  useEffect(() => {
    if (!liveSync || !mediaRef.current || resolvedPlayerType !== "video") return;

    const resync = async () => {
      const media = mediaRef.current;
      if (!media || resyncingRef.current) return;
      resyncingRef.current = true;

      try {
        const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as CanonicalStateResponse;
        const nextUrl = String(data.currentItem?.url || data.mediaUrl || "").trim();
        const offsetSec = Math.max(0, Math.floor(Number(data.offsetSec || 0)));
        if (!nextUrl) return;

        if (!media.currentSrc.includes(nextUrl) && media.getAttribute("src") !== nextUrl) {
          media.setAttribute("src", nextUrl);
          media.load();
        }

        clampSeek(media, offsetSec);
        await media.play().catch(() => undefined);
      } finally {
        resyncingRef.current = false;
      }
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        void resync();
      }
    };

    const focusHandler = () => {
      void resync();
    };

    const interval = window.setInterval(() => {
      void resync();
    }, 30000);

    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("focus", focusHandler);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("focus", focusHandler);
    };
  }, [liveSync, safeUrl, resolvedPlayerType]);

  useEffect(() => {
    return () => {
      allowPauseRef.current = true;
    };
  }, []);

  if (!safeUrl) {
    return (
      <div className={`flex aspect-video w-full items-center justify-center rounded-2xl bg-black text-white/70 ${className}`}>
        Live stream unavailable.
      </div>
    );
  }

  const muteButton = resolvedPlayerType === "video" ? (
    <button
      type="button"
      onClick={() => {
        const media = mediaRef.current;
        if (!media) return;
        const nextMuted = !media.muted;
        media.muted = nextMuted;
        setIsMuted(nextMuted);
      }}
      className="absolute bottom-3 right-3 z-20 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white"
    >
      {isMuted ? "Unmute" : "Mute"}
    </button>
  ) : null;

  if (resolvedPlayerType === "iframe" && ytId) {
    return (
      <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}&mute=1&controls=0&disablekb=1&fs=1&modestbranding=1&playsinline=1&rel=0&start=${Math.max(0, Math.floor(startAtSec || 0))}`}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      <video
        ref={(node) => {
          mediaRef.current = node;
        }}
        src={safeUrl}
        title={title}
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-contain"
      />
      {muteButton}
    </div>
  );
}