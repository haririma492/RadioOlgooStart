"use client";

import { useEffect, useRef } from "react";

type OlgooLivePlayerProps = {
  mediaUrl: string;
  title?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  startAtSec?: number;
  liveSync?: boolean;
};

type LiveStateResponse = {
  currentItem?: {
    title?: string;
    url?: string;
    durationSec?: number;
    mediaType?: string;
    sourceType?: string;
  } | null;
  offsetSec?: number;
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
  startAtSec = 0,
  liveSync = false,
}: OlgooLivePlayerProps) {
  const safeUrl = (mediaUrl || "").trim();
  const ytId = extractYoutubeId(safeUrl);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitialSeekedRef = useRef(false);
  const isResyncingRef = useRef(false);
  const lastResyncAtRef = useRef(0);

  useEffect(() => {
    hasInitialSeekedRef.current = false;
  }, [safeUrl, startAtSec]);

  function seekMedia(el: HTMLMediaElement | null, targetSec: number) {
    if (!el) return;

    const target = Math.max(0, Math.floor(Number(targetSec || 0)));
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }

    try {
      const duration = Number.isFinite(el.duration) ? el.duration : NaN;

      if (Number.isFinite(duration) && duration > 0) {
        el.currentTime = Math.min(target, Math.max(0, duration - 0.25));
      } else {
        el.currentTime = target;
      }
    } catch (error) {
      console.error("Failed to seek media", error);
    }
  }

  function applyInitialSeek(el: HTMLMediaElement | null) {
    if (!el || hasInitialSeekedRef.current) return;

    const target = Math.max(0, Math.floor(Number(startAtSec || 0)));
    if (!Number.isFinite(target) || target <= 0) {
      hasInitialSeekedRef.current = true;
      return;
    }

    const apply = () => {
      seekMedia(el, target);
      hasInitialSeekedRef.current = true;
    };

    if (el.readyState >= 1) {
      apply();
      return;
    }

    const onLoadedMetadata = () => {
      apply();
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
  }

  async function resyncToLive(el: HTMLMediaElement | null) {
    if (!liveSync || !el || isResyncingRef.current) return;

    const now = Date.now();
    if (now - lastResyncAtRef.current < 1500) return;

    isResyncingRef.current = true;
    lastResyncAtRef.current = now;

    try {
      const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Live state fetch failed (${response.status})`);
      }

      const data = (await response.json()) as LiveStateResponse;
      const liveUrl = String(data?.currentItem?.url || "").trim();
      const liveOffsetSec = Math.max(0, Math.floor(Number(data?.offsetSec || 0)));

      if (!liveUrl) return;

      const sameUrl = el.currentSrc.includes(liveUrl) || safeUrl === liveUrl;

      if (!sameUrl) {
        el.src = liveUrl;
        el.load();

        const onLoadedMetadata = async () => {
          seekMedia(el, liveOffsetSec);
          try {
            await el.play();
          } catch {
            // ignore autoplay restrictions or user-gesture issues
          }
          el.removeEventListener("loadedmetadata", onLoadedMetadata);
        };

        el.addEventListener("loadedmetadata", onLoadedMetadata);
        return;
      }

      if (el.readyState >= 1) {
        seekMedia(el, liveOffsetSec);
        try {
          await el.play();
        } catch {
          // ignore autoplay restrictions or user-gesture issues
        }
      } else {
        const onLoadedMetadata = async () => {
          seekMedia(el, liveOffsetSec);
          try {
            await el.play();
          } catch {
            // ignore autoplay restrictions or user-gesture issues
          }
          el.removeEventListener("loadedmetadata", onLoadedMetadata);
        };

        el.addEventListener("loadedmetadata", onLoadedMetadata);
      }
    } catch (error) {
      console.error("Failed to resync live playback", error);
    } finally {
      isResyncingRef.current = false;
    }
  }

  useEffect(() => {
    if (!liveSync) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const media = videoRef.current || audioRef.current;
        if (media && !media.paused) {
          void resyncToLive(media);
        }
      }
    };

    const handleWindowFocus = () => {
      const media = videoRef.current || audioRef.current;
      if (media && !media.paused) {
        void resyncToLive(media);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [liveSync, safeUrl]);

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
          src={`https://www.youtube.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}&playsinline=1&rel=0&start=${Math.max(0, Math.floor(startAtSec || 0))}`}
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
          ref={videoRef}
          src={safeUrl}
          title={title}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={autoPlay}
          controls={controls}
          muted={muted}
          playsInline
          onLoadedMetadata={() => applyInitialSeek(videoRef.current)}
          onPlay={() => {
            if (liveSync) {
              const media = videoRef.current;
              if (media) {
                void resyncToLive(media);
              }
            }
          }}
        />
      ) : isAudio(safeUrl) ? (
        <div className="flex h-full w-full items-center justify-center bg-black px-6">
          <audio
            ref={audioRef}
            src={safeUrl}
            autoPlay={autoPlay}
            controls={controls}
            className="w-full"
            onLoadedMetadata={() => applyInitialSeek(audioRef.current)}
            onPlay={() => {
              if (liveSync) {
                const media = audioRef.current;
                if (media) {
                  void resyncToLive(media);
                }
              }
            }}
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