"use client";

import React from "react";

export default function HeroSection() {
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
      {/* Elevated frame */}
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

        <img
          src="/images/banner1.webp"
          alt="Banner 1"
          style={{
            position: "absolute",
            top: "50%",
            left: "12%",
            width: "25%",
            height: "58%",
            transform: "translate(-50%, -50%)",
            objectFit: "contain",
            objectPosition: "center center",
            display: "block",
            backgroundColor: "#000",
          }}
          draggable={false}
        />

        <img
          src="/images/banner2.webp"
          alt="Banner 2"
          style={{
            position: "absolute",
            top: "50%",
            left: "34%",
            width: "25%",
            height: "58%",
            transform: "translate(-50%, -50%)",
            objectFit: "contain",
            objectPosition: "center center",
            display: "block",
            backgroundColor: "#000",
          }}
          draggable={false}
        />

        <img
          src="/images/banner3.webp"
          alt="Banner 3"
          style={{
            position: "absolute",
            top: "50%",
            left: "62.5%",
            width: "25%",
            height: "58%",
            transform: "translate(-50%, -50%)",
            objectFit: "contain",
            objectPosition: "center center",
            display: "block",
            backgroundColor: "#000",
          }}
          draggable={false}
        />

        <img
          src="/images/banner4.webp"
          alt="Banner 4"
          style={{
            position: "absolute",
            top: "50%",
            left: "87.5%",
            width: "25%",
            height: "58%",
            transform: "translate(-50%, -50%)",
            objectFit: "contain",
            objectPosition: "center center",
            display: "block",
            backgroundColor: "#000",
          }}
          draggable={false}
        />
      </div>
    </section>
  );
}