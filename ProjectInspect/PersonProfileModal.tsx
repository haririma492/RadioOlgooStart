"use client";

import React, { useEffect } from "react";
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
          className="relative bg-[#1a1a1a] rounded-lg p-6 max-w-4xl w-full mx-4 overflow-y-auto scrollbar-hide"
          style={{
            pointerEvents: 'auto',
            maxHeight: 'calc(100vh - 2rem)',
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

          {/* Videos List */}
          {videos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((video) => (
              <div
                key={video.id}
                className="cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20 bg-black">
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors">
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
                {/* Playback Options */}
                <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVideoClick(video, true);
                    }}
                    className="flex-1 text-xs px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                  >
                    Play Here
                  </button>
                  <button
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
