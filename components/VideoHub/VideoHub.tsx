"use client";

import React, { useState, useEffect } from "react";
import VideoCategoryBar from "./VideoCategoryBar";
import VideoRow from "./VideoRow";

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

type MediaItem = {
  PK: string;
  url: string;
  section: string;
  group: string;
  person: string;
  title: string;
  description: string;
  createdAt: string;
};

type VideoHubProps = {
  onVideoClick?: (video: VideoItem) => void;
};

export default function VideoHub({ onVideoClick }: VideoHubProps = {}) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch media from API on mount
  useEffect(() => {
    async function fetchMedia() {
      try {
        setLoading(true);
        const response = await fetch("/api/media");
        const data = await response.json();

        if (data.ok && Array.isArray(data.items)) {
          setMediaItems(data.items);
        } else {
          setError("Failed to load videos");
        }
      } catch (err) {
        setError("Error fetching videos");
        console.error("Error fetching media:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMedia();
  }, []);

  // Filter videos by category
  // Supports two data formats:
  // 1. Old format: section="Youtube Chanel Videos", group="Political Analysis"
  // 2. New format: section="Military", group=""
  const filterVideos = (category: string): VideoItem[] => {
    return mediaItems
      .filter((item) => {
        // Check if it's a video file first
        const url = item.url.toLowerCase();
        if (!url.includes(".mp4")) return false;

        // Handle different data formats for categories
        if (category === "Political Analysis") {
          // Old format: section="Youtube Chanel Videos" AND group="Political Analysis"
          return item.section === "Youtube Chanel Videos" && item.group === "Political Analysis";
        } else if (category === "Military") {
          // New format: section="Military" (any group)
          // OR old format: section="Youtube Chanel Videos" AND group="Military"
          return item.section === "Military" ||
            (item.section === "Youtube Chanel Videos" && item.group === "Military");
        }

        return false;
      })
      .slice(0, 10) // Limit to 10 videos
      .map((item) => ({
        id: item.PK,
        thumbnail: item.url,
        url: item.url,
        title: item.title,
        personName: item.person,
        person: item.person,
        description: item.description,
        createdAt: item.createdAt,
        group: item.group,
      }));
  };

  const politicalVideos = filterVideos("Political Analysis");
  const militaryVideos = filterVideos("Military"); // Adjust this if needed

  const handleVideoClick = (video: VideoItem) => {
    // Call parent callback if provided
    if (onVideoClick) {
      onVideoClick(video);
    }
  };

  if (loading) {
    return (
      <section className="w-full">
        <div className="text-white text-center py-8">Loading videos...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="w-full">
        <div className="text-white text-center py-8">{error}</div>
      </section>
    );
  }

  return (
    <section className="w-full">
      {/* Dates and Mobile Navigation Section */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-6 lg:px-8 py-4 md:py-6 gap-4 md:gap-0">
        {/* Mobile Navigation - Visible only on mobile */}
        <nav className="flex md:hidden items-center gap-4">
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity underline decoration-white underline-offset-4"
          >
            Video Hub
          </a>
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Audio Hub
          </a>
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Video Submission
          </a>
        </nav>

        {/* Dates Display - Right-aligned on desktop */}
        <div className="flex flex-col items-end md:items-end text-right w-full md:w-auto" style={{ width: '100%' }}>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, January 30, 2026
          </div>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, January 30, 2026
          </div>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, 10 Bahman 1404
          </div>
        </div>
      </div>

      {/* Video Hub Main Content */}
      <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 items-start">
        {/* Your Favourite Section - First on mobile, Right on desktop */}
        <div className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 flex flex-col order-1 md:order-2">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Your Favourite</h2>
          <div
            className="w-full rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            style={{ height: 'calc(2 * 180px + 32px)' }}
            onClick={() => handleVideoClick({
              id: 'favourite',
              thumbnail: '/images/faviurite.webp',
              url: '/images/faviurite.webp',
              title: 'Your Favourite',
              personName: 'Jamshed Nasiwal',
            })}
          >
            <img
              src="/images/faviurite.webp"
              alt="Your Favourite"
              className="w-full h-full rounded-lg object-cover"
            />
          </div>
        </div>

        {/* Recent Video Hub Section - Second on mobile, Left on desktop */}
        <div className="flex-1 w-full flex flex-col order-2 md:order-1">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Recent Video Hub</h2>
          <div className="flex gap-4 md:gap-6 lg:gap-8 overflow-visible">
            {/* Category Bar (Left) */}
            <VideoCategoryBar />

            {/* Video Rows (Right) - Constrained to show 5 cards */}
            <div className="flex-1 space-y-6 md:space-y-8 min-w-0 max-w-[calc(5*140px+4*16px)] md:max-w-[calc(5*160px+4*20px)] lg:max-w-[calc(5*180px+4*20px)] overflow-visible">
              <VideoRow
                category="Political"
                videos={politicalVideos}
                onVideoClick={handleVideoClick}
              />
              <VideoRow
                category="Military"
                videos={militaryVideos}
                onVideoClick={handleVideoClick}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
