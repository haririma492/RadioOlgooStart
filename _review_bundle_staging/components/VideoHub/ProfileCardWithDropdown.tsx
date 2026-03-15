"use client";

import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import ProfileCardDropdown from "./ProfileCardDropdown";

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

type ProfileCardWithDropdownProps = {
  profile: { person: string; pictureUrl: string };
  videos: VideoItem[];
  onVideoClick: (video: VideoItem) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onViewAllClick?: () => void;
  /** Opens the Search modal when the Search button is clicked */
  onSearchClick?: () => void;
  /** When set, this card shows an inline video player instead of the profile image */
  playingVideo?: VideoItem | null;
  onClearPlayingVideo?: () => void;
  /** "king" = Your Favourite card, ~1.6x larger than default */
  size?: "default" | "king";
};

export default function ProfileCardWithDropdown({
  profile,
  videos,
  onVideoClick,
  isExpanded,
  onToggle,
  onViewAllClick,
  onSearchClick,
  playingVideo = null,
  onClearPlayingVideo,
  size = "default",
}: ProfileCardWithDropdownProps) {
  const isPlayingOnCard = Boolean(playingVideo);
  const isKing = size === "king";
  const cardRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = () => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position the bottom of the dropdown at the middle of the card
    const targetTop = rect.top + scrollY + (rect.height / 2);

    // Mobile: max 250px so dropdown stays on screen; desktop: 480px
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const dropdownWidth = isMobile ? 250 : 480;
    let targetLeft = rect.left + scrollX;
    const viewportWidth = window.innerWidth;

    if (targetLeft + dropdownWidth > viewportWidth + scrollX - 16) {
      targetLeft = viewportWidth + scrollX - dropdownWidth - 16;
    }
    targetLeft = Math.max(scrollX + 16, targetLeft);

    setDropdownStyle({
      top: targetTop,
      left: targetLeft,
      width: dropdownWidth,
    });
  };

  useLayoutEffect(() => {
    if (isExpanded) {
      updatePosition();
    } else {
      setDropdownStyle(null);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    window.addEventListener("resize", updatePosition);

    // Handle horizontal scroll of parents (which would move the card horizontally)
    const scrollableParent = cardRef.current?.closest(".overflow-x-auto");
    if (scrollableParent) {
      scrollableParent.addEventListener("scroll", updatePosition, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      if (scrollableParent) {
        scrollableParent.removeEventListener("scroll", updatePosition);
      }
    };
  }, [isExpanded]);

  return (
    <div ref={cardRef} className={`relative ${isKing ? "max-w-[360px] lg:max-w-[440px] xl:max-w-[510px] w-full h-full max-h-[calc(100%-50px)] min-h-0 flex flex-col" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full cursor-pointer hover:opacity-90 transition-opacity text-left ${isKing ? "flex-1 min-h-0 max-h-full flex flex-col" : ""}`}
      >
        <div className={`relative overflow-hidden border border-white/20 bg-black ${isKing ? "rounded-2xl flex-1 min-h-0 min-w-0 w-full aspect-square max-h-full max-w-full" : "rounded-lg w-full aspect-square"}`}>
          {isPlayingOnCard && playingVideo ? (
            <div
              className="absolute inset-0"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <video
                key={playingVideo.id}
                src={playingVideo.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                controlsList="nodownload"
              />
              {onClearPlayingVideo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearPlayingVideo();
                  }}
                  className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                  aria-label="Stop video"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ) : profile.pictureUrl ? (
            <img
              src={profile.pictureUrl}
              alt={profile.person}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center text-white text-2xl font-semibold">
              {profile.person.charAt(0).toUpperCase()}
            </div>
          )}

          {!isPlayingOnCard && (
            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5 items-start">
              <span
                className="px-2.5 py-1 rounded-full bg-black/60 text-white/95 text-sm font-medium flex items-center gap-1 border border-white/20"
                aria-hidden
              >
                View videos
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          )}
        </div>
        <div className={`text-white text-sm text-center truncate ${isKing ? "mt-2 flex-shrink-0" : "mt-1"}`}>
          {profile.person}
        </div>
      </button>

      {/* Search button beneath name – king card: taller, narrower, centered */}
      {isKing && onSearchClick && (
        <button
          type="button"
          onClick={onSearchClick}
          className="w-auto min-w-[120px] max-w-[85%] mx-auto mt-1 py-2 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-sm text-white/90 text-sm font-medium border border-white/15 hover:border-white/25 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-white/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      )}
      {/* Search button beneath name – non-king cards (Political, etc.): full width, original size */}
      {!isKing && onSearchClick && (
        <button
          type="button"
          onClick={onSearchClick}
          className="w-full mt-1 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-sm text-white/90 text-sm font-medium border border-white/15 hover:border-white/25 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-white/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      )}

      {/* Dropdown - portaled to body to avoid clipping, positioned absolutely relative to card middle */}
      {isExpanded && dropdownStyle && typeof document !== "undefined" &&
        createPortal(
          <div
            data-profile-dropdown-portal
            className="absolute z-[9999] animate-dropdown-in pointer-events-auto"
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              transform: "translateY(-100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ProfileCardDropdown
              videos={videos}
              onVideoClick={onVideoClick}
              onViewAllClick={onViewAllClick}
            />
          </div>,
          document.body
        )
      }
    </div>
  );
}
