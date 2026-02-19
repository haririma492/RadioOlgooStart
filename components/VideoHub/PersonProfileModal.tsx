"use client";

import React, { useEffect, useRef, useState } from "react";
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

type PersonProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  personName: string;
  profilePictureUrl?: string;
  videos: VideoItem[];
  onVideoClick: (video: VideoItem, playInModal: boolean) => void;
  playingVideo: VideoItem | null;
};

export default function PersonProfileModal({
  isOpen,
  onClose,
  personName,
  videos,
  onVideoClick,
  playingVideo,
}: PersonProfileModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNextButton, setShowNextButton] = useState(true);
  const [showPrevButton, setShowPrevButton] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const checkScrollPosition = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const hasScroll = container.scrollWidth > container.clientWidth;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    const isAtStart = container.scrollLeft <= 10;
    setShowNextButton(hasScroll && !isAtEnd);
    setShowPrevButton(hasScroll && !isAtStart);
  };

  const handleNext = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const firstCard = container.querySelector("[class*=\"flex-shrink-0\"]") as HTMLElement;
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      container.scrollTo({
        left: container.scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handlePrev = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const firstCard = container.querySelector("[class*=\"flex-shrink-0\"]") as HTMLElement;
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      container.scrollTo({
        left: container.scrollLeft - scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && videos.length > 0 && isOpen) {
      const checkWithRAF = () => requestAnimationFrame(checkScrollPosition);
      checkWithRAF();
      const timeoutId = setTimeout(checkWithRAF, 200);
      container.addEventListener("scroll", checkScrollPosition);
      window.addEventListener("resize", checkWithRAF);
      const ro = new ResizeObserver(checkWithRAF);
      ro.observe(container);
      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener("scroll", checkScrollPosition);
        window.removeEventListener("resize", checkWithRAF);
        ro.disconnect();
      };
    }
  }, [videos.length, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Backdrop - light so rest of site stays visible */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        }}
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '1rem',
        }}
      >
        <div
          className="relative flex flex-col bg-[#1a1a1a] rounded-xl border border-white/10 max-w-6xl w-full mx-4 scrollbar-hide"
          style={{
            pointerEvents: 'auto',
            maxHeight: '55vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Close Button - always visible, does not scroll */}
          <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4">
            <h2 className="text-white text-xl md:text-2xl font-semibold">{personName}</h2>
            <button
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
              aria-label="Close modal"
              type="button"
              style={{
                width: '32px',
                height: '32px',
                minWidth: '32px',
                minHeight: '32px',
                backgroundColor: 'transparent',
                border: 'none',
              }}
            >
              <svg
                width="24"
                height="24"
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

          {/* Scrollable content - vertical scrollbar hidden */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 scrollbar-hide">
          {/* Video player only when a video is playing */}
          {playingVideo && (
            <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border border-white/20 bg-black mb-4">
              <video
                key={playingVideo.url}
                src={playingVideo.url}
                controls
                autoPlay
                className="w-full h-full"
                controlsList="nodownload"
              />
            </div>
          )}

          {/* Videos: single horizontal row with prev/next — 4 cards visible at a time */}
          {videos.length > 0 ? (
            <div className="relative w-full">
              <div
                ref={scrollContainerRef}
                className="flex w-full overflow-x-auto overflow-y-hidden scroll-smooth gap-4 -mx-1 px-1 pb-5 scrollbar-modern"
                style={{ scrollBehavior: "smooth" }}
              >
                {videos.map((video) => (
                  <div
                    key={video.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onVideoClick(video, false)}
                    onKeyDown={(e) => e.key === "Enter" && onVideoClick(video, false)}
                    className="flex-shrink-0 w-[250px] cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/20 bg-black">
                      <video
                        src={video.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-start pl-3 bg-black/30 hover:bg-black/20 transition-colors pointer-events-none">
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 48 48"
                          fill="none"
                          className="shrink-0"
                        >
                          <circle cx="24" cy="24" r="20" fill="white" fillOpacity="0.9" />
                          <path
                            d="M20 16L32 24L20 32V16Z"
                            fill="#212B36"
                          />
                        </svg>
                      </div>
                    </div>
                    {video.title && (
                      <div className="text-white text-sm mt-2 truncate">
                        {video.title}
                      </div>
                    )}
                    {video.createdAt && (
                      <div className="text-white/60 text-xs mt-1">
                        {getRelativeTime(video.createdAt)}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVideoClick(video, true);
                        }}
                        className="flex-1 text-xs px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                      >
                        Play Here
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVideoClick(video, false);
                        }}
                        className="flex-1 text-xs px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                      >
                        Play Corner
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showPrevButton && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                  aria-label="Previous"
                >
                  <img
                    src="/svg/nexticon.svg"
                    alt="Previous"
                    className="w-4 h-4 md:w-5 md:h-5 rotate-180"
                  />
                </button>
              )}
              {showNextButton && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                  aria-label="Next"
                >
                  <img
                    src="/svg/nexticon.svg"
                    alt="Next"
                    className="w-4 h-4 md:w-5 md:h-5"
                  />
                </button>
              )}
            </div>
          ) : (
            <div className="text-white/60 text-center py-8">
              No videos available for this person
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
