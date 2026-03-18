"use client";

import React, { useEffect, useState } from "react";
import OlgooLivePlayer from "@/components/OlgooLive/OlgooLivePlayer";
import type { OlgooLivePlayerType } from "@/components/OlgooLive/types";
import { usePlayback } from "@/context/PlaybackContext";

const LIVE_HEARTBEAT_MS = 7_000;

type HeroImageProps = {
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  hoverGlow?: boolean;
  onClick?: () => void;
};

function HeroImage({
  primarySrc,
  fallbackSrc,
  alt,
  hoverGlow = false,
  onClick,
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
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "block",
        cursor: onClick || hoverGlow ? "pointer" : "default",
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
          transition: "filter 0.25s ease, transform 0.25s ease",
          transform: hover ? "scale(1.03)" : "scale(1)",
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

type LiveStateResponse = {
  ok?: boolean;
  canPlay?: boolean;
  clickable?: boolean;
  playState?: "playing" | "stopped" | "paused";
  mediaUrl?: string;
  url?: string;
  streamUrl?: string;
  playbackUrl?: string;
  offsetSec?: number;
  playerType?: OlgooLivePlayerType;
  playToken?: string;
  title?: string;
  currentItem?: {
    title?: string;
    url?: string;
  } | null;
};

type LiveSnapshot = {
  mediaUrl: string;
  playerType: OlgooLivePlayerType;
  offsetSec: number;
  playToken: string;
  title: string;
};

async function fetchLiveState(): Promise<LiveSnapshot | null> {
  const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch live state (${response.status})`);
  }

  const data = (await response.json()) as LiveStateResponse;
  const mediaUrl =
    data?.currentItem?.url ||
    data?.mediaUrl ||
    data?.url ||
    data?.streamUrl ||
    data?.playbackUrl ||
    "";

  const canPlay = Boolean(data?.canPlay ?? data?.clickable ?? data?.playState === "playing");
  if (!canPlay || !mediaUrl) {
    return null;
  }

  return {
    mediaUrl,
    playerType: data?.playerType === "iframe" ? "iframe" : "video",
    offsetSec: Math.max(0, Math.floor(Number(data?.offsetSec || 0))),
    playToken: String(data?.playToken || mediaUrl),
    title: data?.currentItem?.title || data?.title || "Olgoo Live",
  };
}

type LivePlayerOverlayProps = {
  mediaUrl: string;
  playerType: OlgooLivePlayerType;
  startAtSec?: number;
  title: string;
  onClose: () => void;
};

function LivePlayerOverlay({
  mediaUrl,
  playerType,
  startAtSec = 0,
  title,
  onClose,
}: LivePlayerOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        zIndex: 4,
        borderRadius: "inherit",
      }}
    >
      <OlgooLivePlayer
        mediaUrl={mediaUrl}
        title={title}
        playerType={playerType}
        startAtSec={startAtSec}
        liveSync
        autoPlay
        controls={false}
        muted={true}
        className="h-full w-full rounded-none"
      />

      <button
        type="button"
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
  const [livePlayerType, setLivePlayerType] = useState<OlgooLivePlayerType>("video");
  const [liveOffsetSec, setLiveOffsetSec] = useState(0);
  const [liveTitle, setLiveTitle] = useState("Olgoo Live");
  const [livePlayToken, setLivePlayToken] = useState("");
  const [playerKey, setPlayerKey] = useState(0);
  const { activePlayback, setActivePlayback } = usePlayback();

  const applyLiveSnapshot = (snapshot: LiveSnapshot) => {
    const changed =
      snapshot.mediaUrl !== liveMediaUrl ||
      snapshot.playToken !== livePlayToken ||
      snapshot.playerType !== livePlayerType;

    setLiveMediaUrl(snapshot.mediaUrl);
    setLivePlayerType(snapshot.playerType);
    setLiveOffsetSec(snapshot.offsetSec);
    setLiveTitle(snapshot.title);
    setLivePlayToken(snapshot.playToken);

    if (changed) {
      setPlayerKey((value) => value + 1);
    }
  };

  const stopLive = () => {
    setIsLivePlaying(false);
    setLiveMediaUrl(null);
    setLiveOffsetSec(0);
    setLiveTitle("Olgoo Live");
    setLivePlayToken("");
    setActivePlayback(null);
  };

  const handleLiveClick = async () => {
    if (isLivePlaying) return;

    try {
      const snapshot = await fetchLiveState();
      if (!snapshot) {
        throw new Error("Live stream not available");
      }

      applyLiveSnapshot(snapshot);
      setIsLivePlaying(true);
      setActivePlayback("olgoo-live", snapshot.playToken);
    } catch (err) {
      console.error("Failed to start Olgoo Live:", err);
      alert("پخش زنده در دسترس نیست / Live stream not available");
    }
  };

  useEffect(() => {
    if (!isLivePlaying) return;

    let cancelled = false;

    const heartbeat = async () => {
      try {
        const snapshot = await fetchLiveState();

        if (cancelled) return;

        if (!snapshot) {
          stopLive();
          return;
        }

        applyLiveSnapshot(snapshot);
        setActivePlayback("olgoo-live", snapshot.playToken);
      } catch {
        // keep current playback on transient network failure
      }
    };

    const intervalId = window.setInterval(() => {
      void heartbeat();
    }, LIVE_HEARTBEAT_MS);

    const onFocus = () => {
      void heartbeat();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLivePlaying, liveMediaUrl, livePlayToken, livePlayerType, setActivePlayback]);

  useEffect(() => {
    if (activePlayback && activePlayback.source !== "olgoo-live") {
      stopLive();
    }
  }, [activePlayback]);

  const outerCardStyle: React.CSSProperties = {
    width: "min(43vw, 760px)",
    padding: "22px",
    borderRadius: "28px",
    background: "#38979a",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  };

  const innerMediaStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: "18px",
    overflow: "hidden",
    background: "#000",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset",
  };

  return (
    <section
      style={{
        width: "100%",
        padding: 0,
        margin: 0,
        background: "none",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          gap: "3vw",
          flexWrap: "wrap",
          padding: 0,
          margin: 0,
          background: "none",
          border: "none",
          borderRadius: 0,
          boxShadow: "none",
        }}
      >
        <div style={outerCardStyle}>
          <div style={innerMediaStyle}>
            <HeroImage
              primarySrc="/images/PakhsheZendeh3.jpg"
              alt="Pakhsh-e Zendeh"
              hoverGlow={true}
              onClick={handleLiveClick}
            />

            {isLivePlaying && liveMediaUrl && (
              <LivePlayerOverlay
                key={playerKey}
                mediaUrl={liveMediaUrl}
                playerType={livePlayerType}
                startAtSec={liveOffsetSec}
                title={liveTitle}
                onClose={stopLive}
              />
            )}
          </div>
        </div>

        <div style={outerCardStyle}>
          <div style={innerMediaStyle}>
            <HeroImage
              primarySrc="/images/banner3.webp"
              fallbackSrc="/images/banner3.png"
              alt="Banner 3"
            />
          </div>
        </div>
      </div>
    </section>
  );
}