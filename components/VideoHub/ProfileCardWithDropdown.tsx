"use client";

import React from "react";
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
  /** When set, this card shows an inline video player instead of the profile image */
  playingVideo?: VideoItem | null;
  onClearPlayingVideo?: () => void;
};

export default function ProfileCardWithDropdown({
  profile,
  videos,
  onVideoClick,
  isExpanded,
  onToggle,
  onViewAllClick,
  playingVideo = null,
  onClearPlayingVideo,
}: ProfileCardWithDropdownProps) {
  const isPlayingOnCard = Boolean(playingVideo);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="w-full cursor-pointer hover:opacity-90 transition-opacity text-left"
      >
        <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20 bg-black">
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
        </div>
        <div className="text-white text-sm mt-2 text-center truncate">
          {profile.person}
        </div>
      </button>

      {isExpanded && (
        <div
          className="absolute left-0 z-20 mt-2 w-full min-w-[480px] max-w-[min(100vw,480px)] animate-dropdown-in"
          style={{ top: "100%" }}
        >
          <ProfileCardDropdown
            videos={videos}
            onVideoClick={onVideoClick}
            onViewAllClick={onViewAllClick}
          />
        </div>
      )}
    </div>
  );
}
