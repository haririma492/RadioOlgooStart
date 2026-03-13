"use client";

import React from "react";
import { getRelativeTime } from "@/lib/timeUtils";
import type { OlgooLivePlayerType } from "@/components/OlgooLive/types";

type VideoPlayerProps = {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  person?: string;
  title?: string;
  timestamp?: string;
  playerType?: OlgooLivePlayerType;
  sourceLabel?: string;
  isLive?: boolean;
};

export default function FloatingVideoPlayer({
  isOpen,
  onClose,
  videoUrl,
  person,
  title,
  timestamp,
  playerType = "video",
  sourceLabel,
  isLive = false,
}: VideoPlayerProps) {
  if (!isOpen || !videoUrl) return null;

  const relativeTime = timestamp ? getRelativeTime(timestamp) : "";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] overflow-hidden rounded-lg border border-white/10 bg-black/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-start justify-between border-b border-white/10 p-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{person || "Unknown"}</h3>
            {isLive ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">
                Live
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-white/70">{title || "Video"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
            {sourceLabel ? <span>{sourceLabel}</span> : null}
            {relativeTime ? <span>{relativeTime}</span> : null}
          </div>
        </div>
        <button
          onClick={onClose}
          className="-mt-1 ml-2 p-1 text-white/70 transition-colors hover:text-white"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="relative w-full aspect-video bg-black">
        {playerType === "iframe" ? (
          <iframe
            key={videoUrl}
            src={videoUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            title={title || "Olgoo Live"}
          />
        ) : (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            className="h-full w-full"
            controlsList="nodownload"
          />
        )}
      </div>
    </div>
  );
}
