"use client";

import React from "react";
import { getRelativeTime } from "@/lib/timeUtils";

type VideoPlayerProps = {
    isOpen: boolean;
    onClose: () => void;
    videoUrl?: string;
    person?: string;
    title?: string;
    timestamp?: string;
};

export default function FloatingVideoPlayer({
    isOpen,
    onClose,
    videoUrl,
    person,
    title,
    timestamp,
}: VideoPlayerProps) {
    if (!isOpen || !videoUrl) return null;

    const relativeTime = timestamp ? getRelativeTime(timestamp) : "";

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] bg-black/95 backdrop-blur-sm rounded-lg shadow-2xl border border-white/10">
            {/* Header */}
            <div className="flex items-start justify-between p-3 border-b border-white/10">
                <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-semibold truncate">
                        {person || "Unknown"}
                    </h3>
                    <p className="text-white/70 text-xs truncate">{title || "Video"}</p>
                    {relativeTime && (
                        <p className="text-white/50 text-xs mt-0.5">{relativeTime}</p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="ml-2 text-white/70 hover:text-white transition-colors p-1 -mt-1"
                    aria-label="Close"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Video Player */}
            <div className="relative w-full aspect-video bg-black">
                <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    autoPlay
                    className="w-full h-full"
                    controlsList="nodownload"
                />
            </div>
        </div>
    );
}
