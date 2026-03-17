"use client";

import React, { useEffect, useState } from "react";
import OlgooLivePlayer from "@/components/OlgooLive/OlgooLivePlayer";
import type { OlgooLivePlayerType } from "@/components/OlgooLive/types";
import { usePlayback } from "@/context/PlaybackContext";

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

type LiveStateResponse = {
  mediaUrl?: string;
  url?: string;
  streamUrl?: string;
  playbackUrl?: string;
  offsetSec?: number;
  playerType?: OlgooLivePlayerType;
  title?: string;
  currentItem?: {
    url?: string;
    title?: string;
  } | null;
};

type LivePlayerOverlayProps = {
  mediaUrl: string;
  playerType: OlgooLivePlayerType;
  startAtSec: number;
  title: string;
  onClose: () => void;
};

function LivePlayerOverlay({
  mediaUrl,
  playerType,
  startAtSec,
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
        muted
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
          width: 32,
          height: 32,
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
  const [liveStartAtSec, setLiveStartAtSec] = useState(0);
  const [liveTitle, setLiveTitle] = useState("Olgoo Live");
  const { activePlayback, setActivePlayback } = usePlayback();

  const handleLiveClick = async () => {
    if (isLivePlaying) return;

    try {
      const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Failed to fetch live state");

      const data = (await response.json()) as LiveStateResponse;

      const url =
        data?.currentItem?.url ||
        data?.mediaUrl ||
        data?.url ||
        data?.streamUrl ||
        data?.playbackUrl ||
        "";

      if (!url) throw new Error("No live URL available");

      setLiveMediaUrl(url);
      setLivePlayerType(data?.playerType || "video");
      setLiveStartAtSec(Math.max(0, Math.floor(Number(data?.offsetSec || 0))));
      setLiveTitle(data?.currentItem?.title || data?.title || "Olgoo Live");
      setIsLivePlaying(true);
      setActivePlayback("olgoo-live", `${url}:${data?.offsetSec || 0}`);
    } catch (err) {
      console.error("Failed to start Olgoo Live:", err);
      alert("پخش زنده در دسترس نیست / Live stream not available");
    }
  };

  const handleCloseLive = () => {
    setIsLivePlaying(false);
    setLiveMediaUrl(null);
    setLiveStartAtSec(0);
    setActivePlayback(null);
  };

  useEffect(() => {
    if (activePlayback && activePlayback.source !== "olgoo-live") {
      setIsLivePlaying(false);
    }
  }, [activePlayback]);

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "clamp(280px, 36vw, 430px)",
        overflow: "hidden",
        backgroundColor: "#000",
        padding: "4px 6px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "18px",
          border: "1px solid rgba(197,155,65,0.45)",
          background: "rgba(10,10,10,0.88)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 18px rgba(197,155,65,0.10)",
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
              startAtSec={liveStartAtSec}
              title={liveTitle}
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