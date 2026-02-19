"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type VideoModalItem = {
  id: string;
  thumbnail: string;
  timestamp: string; // e.g., "2 hours ago", "6 hours ago", "2 days ago"
};

type VideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videos: VideoModalItem[];
};

export default function VideoModal({ isOpen, onClose, title, videos }: VideoModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 99999,
      }}
    >
      {/* Backdrop - light so rest of site stays visible (same as all modals) */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        style={{
          pointerEvents: 'none',
        }}
      >
        <div
          className="relative rounded-xl border border-white/10 bg-[#1a1a1a] p-6 w-full max-w-[calc(2*308px+10px+48px)] scrollbar-hide"
          style={{
            pointerEvents: 'auto',
            maxHeight: '55vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Title and Close Button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl md:text-2xl font-semibold">{title}</h2>
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
                padding: 0,
                outline: 'none',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  display: 'block',
                }}
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Grid of 6 Cards (2 columns, 3 rows) */}
          <div 
            className="grid grid-cols-2" 
            style={{ 
              gap: '10px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {videos.map((video) => (
              <div 
                key={video.id} 
                className="relative"
                style={{
                  width: '308px',
                  height: '220px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                }}
              >
                {/* Card Image */}
                <div className="relative w-full h-full">
                  <img
                    src={video.thumbnail}
                    alt={`Video ${video.id}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Play Button Overlay - Centered */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  >
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
                  {/* Timestamp - Bottom Right Corner */}
                  <div
                    className="absolute bottom-0 right-0 z-10"
                    style={{
                      padding: '8px 12px',
                    }}
                  >
                    <p className="text-white text-sm font-normal">{video.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to document.body to ensure it's above everything
  if (!mounted || typeof window === 'undefined') {
    return null;
  }
  
  return createPortal(modalContent, document.body);
}
