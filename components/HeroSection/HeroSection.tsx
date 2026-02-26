"use client";

import React from "react";

export default function HeroSection() {
    return (
        <section
            style={{
                position: "relative",
                width: "100%",
                height: "clamp(420px, 55vw, 640px)",
                overflow: "hidden",
            }}
        >
            {/* Background image */}
            <img
                src="/images/headerImageNew26feb.webp"
                alt="Audio-Video Hub of Iranian Civilization and Lion & Sun Revolution"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                }}
            />

            {/* Subtle dark vignette — sides */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.45) 100%)",
                    pointerEvents: "none",
                }}
            />

            {/* Bottom fade — blends into page */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "38%",
                    background:
                        "linear-gradient(to bottom, transparent 0%, rgba(13,10,5,0.75) 60%, rgba(13,10,5,0.98) 100%)",
                    pointerEvents: "none",
                }}
            />

            {/* Top dark veil — so header bar blends naturally */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "18%",
                    background:
                        "linear-gradient(to bottom, rgba(13,10,5,0.5) 0%, transparent 100%)",
                    pointerEvents: "none",
                }}
            />

            {/* Gold decorative bottom border */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background:
                        "linear-gradient(90deg, transparent 0%, rgba(197,155,65,0.6) 20%, rgba(232,201,107,0.9) 50%, rgba(197,155,65,0.6) 80%, transparent 100%)",
                }}
            />



        </section>
    );
}
