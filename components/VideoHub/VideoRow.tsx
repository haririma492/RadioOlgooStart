"use client";

import React, { useRef, useState, useEffect } from "react";
import { getRelativeTime } from "@/lib/timeUtils";

type VideoItem = {
  id: string;
  thumbnail: string;
  url: string;
  title?: string;
  isFavourite?: boolean;
  personName?: string;
  person?: string;
  description?: string;
  createdAt?: string;
  group?: string;
};

type VideoRowProps = {
  videos?: VideoItem[];
  category?: string;
  onVideoClick?: (video: VideoItem) => void;
};

export default function VideoRow({ videos = [], category, onVideoClick }: VideoRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNextButton, setShowNextButton] = useState(true);
  const [showPrevButton, setShowPrevButton] = useState(false);

  // Use provided videos or fall back to empty array
  const displayVideos = videos.length > 0 ? videos : [];

  const handleNext = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Calculate scroll amount based on actual card width
      const firstCard = container.querySelector('div[class*="flex-shrink-0"]') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = window.innerWidth >= 1024 ? 20 : window.innerWidth >= 768 ? 20 : 16; // gap-5 = 20px on md+, gap-4 = 16px on mobile
        // Scroll by exactly 5 cards (to show next set)
        const scrollAmount = (cardWidth + gap) * 5;

        container.scrollTo({
          left: container.scrollLeft + scrollAmount,
          behavior: 'smooth',
        });
      }
    }
  };

  const handlePrev = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Calculate scroll amount based on actual card width
      const firstCard = container.querySelector('div[class*="flex-shrink-0"]') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = window.innerWidth >= 1024 ? 20 : window.innerWidth >= 768 ? 20 : 16;
        // Scroll back by exactly 5 cards
        const scrollAmount = (cardWidth + gap) * 5;

        container.scrollTo({
          left: container.scrollLeft - scrollAmount,
          behavior: 'smooth',
        });
      }
    }
  };

  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Check if content is scrollable (scrollWidth > clientWidth)
      const hasScroll = container.scrollWidth > container.clientWidth;
      // Check if we're at the end
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      // Check if we're at the start
      const isAtStart = container.scrollLeft <= 10;
      // Show buttons based on scroll position
      setShowNextButton(hasScroll && !isAtEnd);
      setShowPrevButton(hasScroll && !isAtStart);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // Function to check with requestAnimationFrame for accurate measurements
      const checkWithRAF = () => {
        requestAnimationFrame(() => {
          checkScrollPosition();
        });
      };

      // Check immediately
      checkWithRAF();

      // Check after images load and DOM is ready
      const timeoutId = setTimeout(checkWithRAF, 200);

      // Check on scroll
      container.addEventListener('scroll', checkScrollPosition);

      // Check on resize
      window.addEventListener('resize', checkWithRAF);

      // Use ResizeObserver to detect when container size changes
      const resizeObserver = new ResizeObserver(() => {
        checkWithRAF();
      });
      resizeObserver.observe(container);

      // Check when images load
      const images = container.querySelectorAll('img');
      const imageLoadHandlers: (() => void)[] = [];
      images.forEach(img => {
        const handler = () => checkWithRAF();
        if (img.complete) {
          // Image already loaded
          checkWithRAF();
        } else {
          img.addEventListener('load', handler);
          imageLoadHandlers.push(handler);
        }
      });

      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkWithRAF);
        resizeObserver.disconnect();
        images.forEach((img, index) => {
          if (imageLoadHandlers[index]) {
            img.removeEventListener('load', imageLoadHandlers[index]);
          }
        });
      };
    }
  }, [displayVideos]);

  return (
    <div className="relative w-full overflow-visible">
      <div
        ref={scrollContainerRef}
        className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth w-full"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
        }}
      >
        {displayVideos.map((video) => (
          <div
            key={video.id}
            className="flex-shrink-0 w-[140px] md:w-[160px] lg:w-[180px] cursor-pointer"
            style={{ scrollSnapAlign: 'start' }}
            onClick={() => onVideoClick && onVideoClick(video)}
          >
            <div className="relative w-full aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
              <video
                src={video.url}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
              />
            </div>
            {/* Timestamp below video */}
            {video.createdAt && (
              <div className="text-white/70 text-xs mt-1.5 truncate">
                {getRelativeTime(video.createdAt)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Previous Button - Left */}
      {showPrevButton && (
        <button
          onClick={handlePrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
          aria-label="Previous"
          type="button"
        >
          <img
            src="/svg/nexticon.svg"
            alt="Previous"
            className="w-4 h-4 md:w-5 md:h-5 rotate-180"
          />
        </button>
      )}

      {/* Next Button - Right */}
      {showNextButton && (
        <button
          onClick={handleNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
          aria-label="Next"
          type="button"
        >
          <img
            src="/svg/nexticon.svg"
            alt="Next"
            className="w-4 h-4 md:w-5 md:h-5"
          />
        </button>
      )}
    </div>
  );
}
