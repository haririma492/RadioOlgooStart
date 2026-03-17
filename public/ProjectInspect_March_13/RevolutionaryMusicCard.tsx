"use client";

import React, { useRef, useEffect } from "react";

export type RevolutionaryMusicItem = {
  PK: string;
  url: string;
  section: string;
  group: string;
  person: string;
  title: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

type RevolutionaryMusicCardProps = {
  item: RevolutionaryMusicItem;
  isPlaying: boolean;
  onClick: () => void;
};

const truncate = (str: string, max = 25) =>
  (str || "").length > max ? (str || "").slice(0, max) + "..." : str || "";

export default function RevolutionaryMusicCard({
  item,
  isPlaying,
  onClick,
}: RevolutionaryMusicCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleText = item.title || "Untitled";
  const descText = item.person
    ? `Singer: ${item.person}`
    : (item.description || "");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.muted = false;
      video.play().catch(() => {});
    } else {
      video.muted = true;
      video.pause();
    }
  }, [isPlaying]);

  const startPlayback = () => {
    if (!isPlaying) {
      const v = videoRef.current;
      if (v) {
        v.muted = false;
        v.play().catch(() => {});
      }
    }
  };

  const handleClick = () => {
    startPlayback();
    onClick();
  };

  return (
    <button
      type="button"
      onPointerDown={startPlayback}
      onClick={handleClick}
      className="flex-shrink-0 w-[140px] md:w-[152px] text-left rounded-xl overflow-hidden border border-white/20 bg-black shadow-lg hover:shadow-xl hover:scale-[1.02] hover:border-white/40 active:scale-[0.99] transition-all duration-200 flex flex-col group/card"
    >
      {/* Image section – dominant, taller than text block */}
      <div className="relative w-full aspect-square overflow-hidden flex-shrink-0">
        <video
          ref={videoRef}
          src={item.url}
          className={`w-full h-full object-cover ${!isPlaying ? "pointer-events-none" : ""}`}
          preload="auto"
          muted
          playsInline
          loop
          controls={isPlaying}
        />
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors pointer-events-none" />
        )}
        {/* Play icon – hidden when playing (video controls shown instead) */}
        {!isPlaying && (
          <span
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow pointer-events-none bg-white/90 text-neutral-800"
            style={{ minWidth: "20px", minHeight: "20px" }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              className="ml-0.5 flex-shrink-0"
            >
              <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
            </svg>
          </span>
        )}
      </div>
      {/* White section – full area beneath image */}
      <div className="flex-1 min-h-[56px] w-full flex flex-col justify-center gap-0.5 bg-white px-3 py-2.5">
        <span
          title={titleText}
          className="text-neutral-900 font-semibold text-[13px] leading-tight line-clamp-2"
        >
          {truncate(titleText, 25)}
        </span>
        {descText ? (
          <span
            title={descText}
            className="text-neutral-500 text-[11px] truncate"
          >
            {truncate(descText, 25)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
