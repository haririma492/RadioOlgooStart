"use client";

import React, { useRef, useState } from "react";

type HeroImageProps = {
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  side?: "left" | "right";
  hoverGlow?: boolean;
  onClick?: () => void;
  fillContainer?: boolean;
};

function HeroImage({
  primarySrc,
  fallbackSrc,
  alt,
  side = "left",
  hoverGlow = false,
  onClick,
  fillContainer = false,
}: HeroImageProps) {
  const [src, setSrc] = useState(primarySrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => hoverGlow && setHover(true)}
      onMouseLeave={() => hoverGlow && setHover(false)}
      style={{
        position: "absolute",
        top: fillContainer ? 0 : "50%",
        left: fillContainer ? 0 : side === "left" ? "6%" : undefined,
        right: fillContainer ? undefined : side === "right" ? "6%" : undefined,
        width: fillContainer ? "100%" : "38%",
        height: fillContainer ? "100%" : "72%",
        transform: fillContainer
          ? hover
            ? "scale(1.03)"
            : "none"
          : hover
            ? "translateY(-50%) scale(1.03)"
            : "translateY(-50%)",
        transition: "all 0.25s ease",
        cursor: onClick || hoverGlow ? "pointer" : "default",
        zIndex: 2,
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "block",
      }}
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center center",
          display: "block",
          backgroundColor: "#000",
          filter: hoverGlow
            ? hover
              ? "drop-shadow(0 0 18px rgba(255,220,120,0.75)) drop-shadow(0 0 40px rgba(255,200,80,0.55))"
              : "none"
            : "none",
          transition: "filter 0.25s ease",
        }}
        draggable={false}
        onError={() => {
          if (!triedFallback && fallbackSrc) {
            setTriedFallback(true);
            setSrc(fallbackSrc);
          }
        }}
      />
    </button>
  );
}

type LivePlayerOverlayProps = {
  mediaUrl: string;
  playerType: "video" | "hls" | "dash";
  startAtSec?: number;
  onClose: () => void;
};

function LivePlayerOverlay({
  mediaUrl,
  playerType,
  startAtSec = 0,
  onClose,
}: LivePlayerOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function seekTo(el: HTMLVideoElement, targetSec: number) {
    const target = Math.max(0, Math.floor(Number(targetSec || 0)));
    if (target <= 0) return;

    try {
      const duration = Number.isFinite(el.duration) ? el.duration : NaN;
      el.currentTime =
        Number.isFinite(duration) && duration > 0
          ? Math.min(target, Math.max(0, duration - 0.25))
          : target;
    } catch (error) {
      console.error("Failed to seek live media", error);
    }
  }

  async function resyncAndPlay(el: HTMLVideoElement | null) {
    if (!el) return;

    try {
      const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch live state (${response.status})`);
      }

      const data = await response.json();

      const liveUrl =
        data?.currentItem?.url ||
        data?.mediaUrl ||
        data?.url ||
        data?.streamUrl ||
        data?.playbackUrl ||
        "";

      const liveOffsetSec = Math.max(0, Math.floor(Number(data?.offsetSec || 0)));

      if (!liveUrl) return;

      const sameUrl =
        el.currentSrc === liveUrl ||
        el.currentSrc.includes(liveUrl) ||
        mediaUrl === liveUrl;

      const playAtLivePoint = async () => {
        await seekTo(el, liveOffsetSec);
        await el.play();
        setIsPaused(false);
      };

      if (!sameUrl) {
        el.src = liveUrl;
        el.load();

        const onLoadedMetadata = async () => {
          try {
            await playAtLivePoint();
          } catch (error) {
            console.error("Failed to resume live media", error);
          }
          el.removeEventListener("loadedmetadata", onLoadedMetadata);
        };

        el.addEventListener("loadedmetadata", onLoadedMetadata);
        return;
      }

      await playAtLivePoint();
    } catch (error) {
      console.error("Failed to resync live playback", error);
      try {
        await el.play();
        setIsPaused(false);
      } catch {
        // ignore
      }
    }
  }

  async function handlePlayPause() {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      await resyncAndPlay(el);
    } else {
      el.pause();
      setIsPaused(true);
    }
  }

  async function handleFullscreenToggle() {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await container.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen", error);
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        zIndex: 4,
        borderRadius: "inherit",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls={false}
        onLoadedMetadata={(e) => {
          void seekTo(e.currentTarget, startAtSec);
        }}
        onPause={() => {
          setIsPaused(true);
        }}
        onPlay={() => {
          setIsPaused(false);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
        }}
      >
        <source
          src={mediaUrl}
          type={playerType === "hls" ? "application/x-mpegURL" : "video/mp4"}
        />
        Your browser does not support the video tag.
      </video>

<img
  src="/images/logo_circular.png"
  alt="Olgoo logo"
  style={{
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 20,
    width: 64,
    height: 64,
    objectFit: "contain",
    pointerEvents: "none",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))",
  }}
/>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          zIndex: 20,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => void handlePlayPause()}
          style={{
            background: "rgba(0,0,0,0.65)",
            color: "white",
            border: "none",
            borderRadius: 999,
            minWidth: 72,
            height: 36,
            padding: "0 14px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          aria-label={isPaused ? "Play live" : "Pause live"}
        >
          {isPaused ? "Play" : "Pause"}
        </button>

        <button
          onClick={() => void handleFullscreenToggle()}
          style={{
            background: "rgba(0,0,0,0.65)",
            color: "white",
            border: "none",
            borderRadius: 999,
            minWidth: 98,
            height: 36,
            padding: "0 14px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? "Exit Full" : "Fullscreen"}
        </button>
      </div>

      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.65)",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          fontSize: 18,
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
        aria-label="Close live player"
      >
        ✕
      </button>
    </div>
  );
}

export default function HeroSection() {
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [liveMediaUrl, setLiveMediaUrl] = useState<string | null>(null);
  const [livePlayerType, setLivePlayerType] = useState<"video" | "hls" | "dash">("video");
  const [liveOffsetSec, setLiveOffsetSec] = useState(0);

  const handleLiveClick = async () => {
    if (isLivePlaying) return;

    try {
      const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Failed to fetch live state");

      const data = await response.json();

      const url =
        data?.currentItem?.url ||
        data?.mediaUrl ||
        data?.url ||
        data?.streamUrl ||
        data?.playbackUrl ||
        "";

      if (!url) throw new Error("No live URL available");

      setLiveMediaUrl(url);
      setLiveOffsetSec(Number(data?.offsetSec || 0));
      setLivePlayerType(data?.playerType || "video");
      setIsLivePlaying(true);
    } catch (err) {
      console.error("Failed to start Olgoo Live:", err);
      alert("پخش زنده در دسترس نیست / Live stream not available");
    }
  };

  const handleCloseLive = () => {
    setIsLivePlaying(false);
    setLiveMediaUrl(null);
    setLiveOffsetSec(0);
  };

  return (
<section
  style={{
    position: "relative",
    width: "100%",
    height: "clamp(280px, 36vw, 430px)",
    overflow: "visible",
    backgroundColor: "transparent",
    padding: 0,
  }}
>
<div
  style={{
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: "18px",
    border: "none",
    background: "transparent",
    boxShadow: "none",
    overflow: "hidden",
  }}
>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 18%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "6%",
            width: "38%",
            height: "72%",
            transform: "translateY(-50%)",
            zIndex: 2,
          }}
        >
          <HeroImage
            primarySrc="/images/PakhsheZendeh3.jpg"
            alt="Pakhsh-e Zendeh"
            hoverGlow={true}
            onClick={handleLiveClick}
            fillContainer={true}
          />

          {isLivePlaying && liveMediaUrl && (
            <LivePlayerOverlay
              mediaUrl={liveMediaUrl}
              playerType={livePlayerType}
              startAtSec={liveOffsetSec}
              onClose={handleCloseLive}
            />
          )}
        </div>

        <HeroImage
          primarySrc="/images/banner3.webp"
          fallbackSrc="/images/banner3.png"
          alt="Banner 3"
          side="right"
        />
      </div>
    </section>
  );
}