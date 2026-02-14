"use client";

import React, { useEffect } from "react";
import { getRelativeTime } from "@/lib/timeUtils";

type VideoItem = {
  id: string;
  thumbnail: string;
  url: string;
  title?: string;
  personName?: string;
  person?: string;
  description?: string;
  createdAt?: string;
  group?: string;
};

type ProfileCardDropdownProps = {
  videos: VideoItem[];
  onVideoClick: (video: VideoItem) => void;
  onClose?: () => void;
  onViewAllClick?: () => void;
};

const MAX_VIDEOS_IN_DROPDOWN = 4;

export default function ProfileCardDropdown({
  videos,
  onVideoClick,
  onClose,
  onViewAllClick,
}: ProfileCardDropdownProps) {
  const showViewAll = Boolean(onViewAllClick && videos.length > MAX_VIDEOS_IN_DROPDOWN);
  const displayVideos = showViewAll ? videos.slice(0, MAX_VIDEOS_IN_DROPDOWN) : videos;

  useEffect(() => {
    if (!onClose) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-xl border border-white/20 bg-[#1a1a1a]"
      style={{
        maxHeight: "min(60vh, 420px)",
        minWidth: "min(100%, 480px)",
        width: "min(100%, 480px)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-sm font-medium tracking-wide">Videos</span>
          {videos.length > 0 && (
            <span className="text-white/50 text-xs tabular-nums">{videos.length} total</span>
          )}
        </div>
      </div>

      <div className="overflow-y-auto scrollbar-hide py-2" style={{ maxHeight: "min(52vh, 360px)" }}>
        {videos.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/50 text-sm">
            No videos available
          </div>
        ) : (
          <>
            {displayVideos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => onVideoClick(video)}
                className="w-full flex items-center gap-3 px-4 py-3 mx-1 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all duration-150 text-left group"
              >
                <div className="relative flex-shrink-0 w-[88px] h-[50px] rounded-lg overflow-hidden bg-black/40 ring-1 ring-white/10">
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors">
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center flex-shrink-0 shadow"
                      style={{ minWidth: "20px", minHeight: "20px" }}
                    >
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-800 ml-0.5 flex-shrink-0"
                      >
                        <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium line-clamp-2 leading-snug">
                    {video.title || "Untitled"}
                  </div>
                  {video.createdAt && (
                    <div className="text-white/45 text-xs mt-1">
                      {getRelativeTime(video.createdAt)}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {showViewAll && (
              <div className="px-4 pt-2 pb-2 mt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={onViewAllClick}
                  className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>View all {videos.length} videos</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
