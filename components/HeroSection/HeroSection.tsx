"use client";

import React, { useState } from "react";

type HeroImageProps = {
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  side: "left" | "right";
  hoverGlow?: boolean;
  onClick?: () => void;
};

function HeroImage({
  primarySrc,
  fallbackSrc,
  alt,
  side,
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
        top: "50%",
        [side]: "6%",
        width: "38%",
        height: "72%",
        transform: hover ? "translateY(-50%) scale(1.03)" : "translateY(-50%)",
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

type HeroSectionProps = {
  onLivePhotoClick?: () => void;
};

export default function HeroSection({ onLivePhotoClick }: HeroSectionProps) {
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

        <HeroImage
          primarySrc="/images/PakhsheZendeh3.jpg"
          alt="Pakhsh-e Zendeh"
          side="left"
          hoverGlow={true}
          onClick={onLivePhotoClick}
        />

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
