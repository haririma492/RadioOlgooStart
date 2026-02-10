"use client";

import React, { useRef, useState, useEffect } from "react";

type AudioItem = {
  id: string;
  thumbnail: string;
  title: string;
  singer?: string;
};

type AudioRowProps = {
  audios?: AudioItem[];
  category?: string;
};

export default function AudioRow({ audios = [], category }: AudioRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNextButton, setShowNextButton] = useState(true);
  const [showPrevButton, setShowPrevButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Create mock audios using same image
  const mockAudios: AudioItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `${category}-${i + 1}`,
    thumbnail: "/images/audio-hub-first-image.webp",
    title: "The Last Man On Earth",
    singer: "Barley Chock",
  }));

  const displayAudios = audios.length > 0 ? audios : mockAudios;

  const handleNext = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector('div[class*="flex-shrink-0"]') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = 5.39; // Figma gap value
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
      const firstCard = container.querySelector('div[class*="flex-shrink-0"]') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = 5.39; // Figma gap value
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
      const hasScroll = container.scrollWidth > container.clientWidth;
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      const isAtStart = container.scrollLeft <= 10;
      setShowNextButton(hasScroll && !isAtEnd);
      setShowPrevButton(hasScroll && !isAtStart);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const checkWithRAF = () => {
        requestAnimationFrame(() => {
          checkScrollPosition();
        });
      };
      
      checkWithRAF();
      const timeoutId = setTimeout(checkWithRAF, 200);
      container.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkWithRAF);
      
      const resizeObserver = new ResizeObserver(() => {
        checkWithRAF();
      });
      resizeObserver.observe(container);
      
      const images = container.querySelectorAll('img');
      const imageLoadHandlers: (() => void)[] = [];
      images.forEach(img => {
        const handler = () => checkWithRAF();
        if (img.complete) {
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
  }, [displayAudios]);

  return (
    <div className="relative w-full overflow-visible">
      <div
        ref={scrollContainerRef}
        className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth w-full"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
          gap: isMobile ? '6.16px' : '5.39px',
        }}
      >
        {displayAudios.map((audio) => (
          <div
            key={audio.id}
            className="flex-shrink-0"
            style={{ 
              scrollSnapAlign: 'start',
              width: isMobile ? '171.00936889648438px' : '171px',
            }}
          >
            {/* Audio Card */}
            <div
              className="flex flex-col bg-white"
              style={{
                borderRadius: '9.24px',
                overflow: 'hidden',
              }}
            >
              {/* Image Section with Music Icon in Center */}
              <div className="relative w-full overflow-hidden" style={{ 
                height: isMobile ? "128.64218139648438px" : "135px",
                width: '100%'
              }}>
                <img
                  src={audio.thumbnail}
                  alt={audio.title}
                  className="w-full h-full object-cover"
                />
                {/* Music Icon Overlay - Center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <img
                    src="/svg/Music.svg"
                    alt="Music"
                    className="w-8 h-8 md:w-10 md:h-10"
                  />
                </div>
              </div>
              
              {/* White Text Section */}
              <div 
                className="bg-white"
                style={{
                  paddingBottom: '6.16px',
                  paddingTop: '5.39px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                }}
              >
                {/* Title */}
                <h3 
                  className="font-semibold mb-1"
                  style={{
                    fontFamily: 'var(--font-urbanist), sans-serif',
                    fontSize: '18.49px',
                    lineHeight: '150%',
                    letterSpacing: '0px',
                    color: '#212B36',
                    fontWeight: 600,
                  }}
                >
                  {audio.title}
                </h3>
                {/* Subtitle */}
                <p 
                  className="font-normal"
                  style={{
                    fontFamily: 'var(--font-urbanist), sans-serif',
                    fontSize: '9.24px',
                    lineHeight: '150%',
                    letterSpacing: '0px',
                    color: '#919EAB',
                    fontWeight: 400,
                  }}
                >
                  Singer: {audio.singer}
                </p>
              </div>
            </div>
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
