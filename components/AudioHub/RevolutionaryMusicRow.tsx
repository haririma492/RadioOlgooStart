"use client";

import React, { useRef, useState, useEffect } from "react";
import RevolutionaryMusicCard, { RevolutionaryMusicItem } from "./RevolutionaryMusicCard";

type RevolutionaryMusicRowProps = {
  groupName: string;
  items: RevolutionaryMusicItem[];
  playingItemId: string | null;
  onCardClick: (item: RevolutionaryMusicItem) => void;
};

export default function RevolutionaryMusicRow({
  groupName,
  items,
  playingItemId,
  onCardClick,
}: RevolutionaryMusicRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNextButton, setShowNextButton] = useState(true);
  const [showPrevButton, setShowPrevButton] = useState(false);

  const handleNext = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector("[class*=\"flex-shrink-0\"]") as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = window.innerWidth >= 768 ? 24 : 16;
        const scrollAmount = cardWidth + gap;
        container.scrollTo({
          left: container.scrollLeft + scrollAmount,
          behavior: "smooth",
        });
      }
    }
  };

  const handlePrev = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector("[class*=\"flex-shrink-0\"]") as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = window.innerWidth >= 768 ? 24 : 16;
        const scrollAmount = cardWidth + gap;
        container.scrollTo({
          left: container.scrollLeft - scrollAmount,
          behavior: "smooth",
        });
      }
    }
  };

  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const hasScroll = container.scrollWidth > container.clientWidth;
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      const isAtStart = container.scrollLeft <= 10;
      setShowNextButton(hasScroll && !isAtEnd);
      setShowPrevButton(hasScroll && !isAtStart);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && items.length > 0) {
      const checkWithRAF = () => {
        requestAnimationFrame(checkScrollPosition);
      };
      checkWithRAF();
      const timeoutId = setTimeout(checkWithRAF, 200);
      container.addEventListener("scroll", checkScrollPosition);
      window.addEventListener("resize", checkWithRAF);
      const resizeObserver = new ResizeObserver(checkWithRAF);
      resizeObserver.observe(container);
      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener("scroll", checkScrollPosition);
        window.removeEventListener("resize", checkWithRAF);
        resizeObserver.disconnect();
      };
    }
  }, [items]);

  return (
    <div className="flex items-center  overflow-visible">
      <div
        className="flex-shrink-0 flex items-center justify-center w-[56px] md:w-[64px]"
        style={{ minHeight: "140px" }}
      >
        <span
          className="text-white text-xl md:text-2xl font-normal opacity-80 whitespace-nowrap"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            letterSpacing: "0.05em",
          }}
        >
          {groupName}
        </span>
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-5 lg:p-6 pb-8 md:pb-10 relative">
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto overflow-y-hidden scroll-smooth gap-4 md:gap-6 -mx-1 px-1 pb-1"
          style={{ scrollBehavior: "smooth" }}
        >
          {items.length === 0 ? (
            <div className="text-white/60 text-center py-4 w-full">
              No music available for {groupName}
            </div>
          ) : (
            items.map((item) => (
              <RevolutionaryMusicCard
                key={item.PK}
                item={item}
                isPlaying={playingItemId === item.PK}
                onClick={() => onCardClick(item)}
              />
            ))
          )}
        </div>

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
    </div>
  );
}
