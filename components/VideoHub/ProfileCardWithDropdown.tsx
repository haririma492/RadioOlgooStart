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
};

export default function ProfileCardWithDropdown({
  profile,
  videos,
  onVideoClick,
  isExpanded,
  onToggle,
  onViewAllClick,
}: ProfileCardWithDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="w-full cursor-pointer hover:opacity-90 transition-opacity text-left"
      >
        <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20 bg-white/5">
          {profile.pictureUrl ? (
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
          className="absolute left-0 z-20 mt-2 min-w-[100%] animate-dropdown-in"
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
