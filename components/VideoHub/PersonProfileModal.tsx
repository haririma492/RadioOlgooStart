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
  profilePictureUrl: string;
  videos: VideoItem[];
  onVideoClick: (video: VideoItem, playInModal: boolean) => void;
  playingVideo: VideoItem | null;
};

export default function PersonProfileModal({
  isOpen,
  onClose,
  personName,
  profilePictureUrl,
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
      {/* Backdrop Overlay - Blurs everything including header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(40px)',
          backgroundColor: 'rgba(60, 60, 60, 0.08)', // #3C3C3C14
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
          className="relative bg-[#1a1a1a] rounded-lg p-6 max-w-6xl w-full mx-4 overflow-y-auto scrollbar-hide"
          style={{
            pointerEvents: 'auto',
            maxHeight: '75vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Close Button */}
          <div className="flex items-center justify-between mb-6">
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

          {/* Profile Picture or Video Player */}
          <div className="flex justify-center mb-6">
            {playingVideo ? (
              <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border border-white/20 bg-black">
                <video
                  key={playingVideo.url}
                  src={playingVideo.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                  controlsList="nodownload"
                />
              </div>
            ) : profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt={personName}
                className="w-32 h-32 rounded-full object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center text-white text-4xl font-semibold border-2 border-white/20">
                {personName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Videos: single horizontal row with prev/next — 4 cards visible at a time */}
          {videos.length > 0 ? (
            <div className="relative w-full mt-6 mb-6">
              <div
                ref={scrollContainerRef}
                className="flex w-full overflow-x-auto overflow-y-hidden scroll-smooth gap-4 -mx-1 px-1 pb-1"
                style={{ scrollBehavior: "smooth" }}
              >
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="flex-shrink-0 w-[calc((100%-3*1rem)/4)] min-w-[calc((100%-3*1rem)/4)] cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20 bg-black">
                      <video
                        src={video.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors pointer-events-none">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 48 48"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
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
  );
}
