"use client";

import React, { useRef } from "react";

type LiveChannel = {
  id: string;
  name: string;
  thumbnail: string;
  streamUrl?: string;
  isLive: boolean;
};

type LiveChannelsProps = {
  channels?: LiveChannel[];
};

export default function LiveChannels({ channels = [] }: LiveChannelsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // One card height (card + gap) so we scroll one card per click; mobile image reduced so cards are shorter
  const mobileImageHeight = 120;
  const mobileCardHeight = mobileImageHeight + 24 + 6.16;
  const desktopCardHeight = 116;
  const gap = isMobile ? 6.16 : 16;
  const oneCardHeight = isMobile ? mobileCardHeight : desktopCardHeight;
  const containerHeight = isMobile ? 3 * mobileCardHeight + 2 * gap : 3 * 210.2 + 2 * 48;

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mock channels data - Added more channels to make it scrollable
  const mockChannels: LiveChannel[] = [
    { id: '1', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '2', name: 'Aflaq TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '3', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '4', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '5', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '6', name: 'Aflaq TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '7', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '8', name: 'Aflaq TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '9', name: 'Abadan TV', thumbnail: '/images/live-channel.webp', isLive: true },
    { id: '10', name: 'Aflaq TV', thumbnail: '/images/live-channel.webp', isLive: true },
  ];

  const displayChannels = channels.length > 0 ? channels : mockChannels;

  // Scroll one card at a time: how many cards fit in view, then max steps = length - visible
  const cardsVisible = Math.max(1, Math.floor(containerHeight / oneCardHeight));
  const maxPage = Math.max(0, displayChannels.length - cardsVisible);
  const showDownArrow = currentPage < maxPage;
  const showUpArrow = currentPage > 0;

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTransitioning || currentPage >= maxPage) return;
    setIsTransitioning(true);
    setCurrentPage((prev) => prev + 1);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTransitioning || currentPage <= 0) return;
    setIsTransitioning(true);
    setCurrentPage((prev) => prev - 1);
    setTimeout(() => setIsTransitioning(false), 500);
  };



  return (
    <div className="w-full flex flex-col relative">
      <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Live Channels</h2>
      <div className="relative overflow-visible">
        <div 
          ref={contentRef}
          className="w-full rounded-lg p-4"
          style={{
            height: isMobile ? `${containerHeight}px` : 'calc(3 * 210.2px + 2 * 48px)',
            background: '#FFFFFF29',
            backdropFilter: 'blur(36.974998474121094px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              transition: 'transform 0.5s ease-in-out',
              transform: `translateY(-${currentPage * oneCardHeight}px)`,
              display: 'flex',
              flexDirection: 'column',
              gap: `${gap}px`,
            }}
          >
        {displayChannels.map((channel, index) => {
          // First 3 channels have darker red dots, rest are lighter
          const dotOpacity = index < 3 ? 1.0 : 0.4;
          
          return (
            <div 
              key={channel.id} 
              className="flex items-center"
              style={{ gap: isMobile ? '6.16px' : '8px' }}
            >
              {/* Live Indicator - Left side, vertically centered with image */}
              {channel.isLive && (
                <div className="flex-shrink-0" style={{paddingRight:"20%"}}>
                  <div 
                    className="rounded-full"
                    style={{ 
                      opacity: dotOpacity,
                      background: '#FF4842',
                      width: '13.40625px',
                      height: '13.40625px'
                    }}
                  ></div>
                </div>
              )}
              {/* Right side: Image and Channel Name stacked */}
              <div className="flex flex-col flex-1">
                {/* Thumbnail with Play Button */}
                <div className="relative flex-shrink-0 mb-2">
                  <img
                    src={channel.thumbnail}
                    alt={channel.name}
                    className="rounded object-cover"
                    style={{
                      height: isMobile ? `${mobileImageHeight}px` : '84px',
                      width: isMobile ? '280px' : '191px'
                    }}
                  />
                  {/* Play Button Overlay - Center of image */}
                  <div 
                    className="absolute z-10"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.9"/>
                      <path d="M10 8L16 12L10 16V8Z" fill="#212B36"/>
                    </svg>
                  </div>
                </div>
                {/* Channel Name - Directly beneath image */}
                <div className="flex items-start">
                  <p className="text-white text-sm md:text-base font-normal">{channel.name}</p>
                </div>
              </div>
            </div>
          );
        })}
          </div>
        </div>
        {/* Up Arrow - Top (so it doesn't overlap the Down arrow; prevents click loop) */}
        {showUpArrow && (
          <div
            className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 cursor-pointer"
            onClick={handlePrev}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              pointerEvents: "auto",
              userSelect: "none",
              display: "block",
              visibility: "visible",
              touchAction: "manipulation",
            }}
          >
            <img
              src="/svg/nexticon.svg"
              alt="Scroll up"
              className="w-6 h-6 md:w-8 md:h-8 -rotate-90 opacity-90 hover:opacity-100 transition-opacity pointer-events-none"
              draggable={false}
            />
          </div>
        )}
        {/* Down Arrow - Bottom */}
        {showDownArrow && (
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 z-50 cursor-pointer"
            onClick={handleNext}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              pointerEvents: "auto",
              userSelect: "none",
              display: "block",
              visibility: "visible",
              touchAction: "manipulation",
            }}
          >
            <img
              src="/svg/nexticon.svg"
              alt="Scroll down"
              className="w-6 h-6 md:w-8 md:h-8 rotate-90 opacity-90 hover:opacity-100 transition-opacity pointer-events-none"
              draggable={false}
              style={{ display: "block" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
