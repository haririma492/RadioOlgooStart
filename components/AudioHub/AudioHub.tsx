"use client";

import React, { useState, useEffect } from "react";
import RevolutionaryMusicRow from "./RevolutionaryMusicRow";
import LiveChannels from "../LiveChannels/LiveChannels";
import type { RevolutionaryMusicItem } from "./RevolutionaryMusicCard";
import { usePlayback } from "@/context/PlaybackContext";
import type { MediaItem } from "@/types/media";

type AudioHubProps = {
  mediaItems?: MediaItem[];
  mediaLoading?: boolean;
};

export default function AudioHub({ mediaItems: mediaItemsProp, mediaLoading: mediaLoadingProp }: AudioHubProps = {}) {
  const { activePlayback, setActivePlayback } = usePlayback();
  const [internalMediaItems, setInternalMediaItems] = useState<MediaItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);

  const mediaItems = mediaItemsProp !== undefined ? mediaItemsProp : internalMediaItems;
  const loading = mediaLoadingProp !== undefined ? mediaLoadingProp : internalLoading;

  useEffect(() => {
    if (activePlayback && activePlayback.source !== "revolutionary-music") {
      setPlayingItemId(null);
    }
  }, [activePlayback]);

  useEffect(() => {
    if (mediaItemsProp !== undefined) return;
    async function fetchMedia() {
      try {
        setInternalLoading(true);
        setError(null);
        const response = await fetch("/api/media");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.ok && Array.isArray(data.items)) {
          setInternalMediaItems(data.items);
        } else {
          setError("Failed to load media: Invalid response format");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error fetching media";
        setError(msg);
        console.error("Error fetching media:", err);
      } finally {
        setInternalLoading(false);
      }
    }
    fetchMedia();
  }, [mediaItemsProp]);

  const revolutionMusicItems = mediaItems.filter(
    (item) =>
      (item.section ?? "").trim() === "RevolutionMusic" &&
      (item.url ?? "").toLowerCase().includes(".mp4")
  );

  const groupsMap = new Map<string, RevolutionaryMusicItem[]>();
  for (const item of revolutionMusicItems) {
    const g = (item.group ?? "").trim() || "Other";
    if (!groupsMap.has(g)) groupsMap.set(g, []);
    groupsMap.get(g)!.push(item as RevolutionaryMusicItem);
  }

  const orderedGroups = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === "Epic") return -1;
    if (b === "Epic") return 1;
    return a.localeCompare(b);
  });

  const handleCardClick = (item: RevolutionaryMusicItem) => {
    if (playingItemId === item.PK) {
      setActivePlayback(null);
      setPlayingItemId(null);
      return;
    }
    setActivePlayback("revolutionary-music", item.PK);
    setPlayingItemId(item.PK);
  };

  if (loading) {
    return (
      <section className="w-full">
        <div className="w-full px-4 md:px-6 lg:px-8 pb-8">
          <div className="text-white text-center py-8">Loading revolutionary music...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="w-full">
        <div className="w-full px-4 md:px-6 lg:px-8 pb-8">
          <div className="text-white text-center py-8">{error}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 items-stretch">
        <div className="flex-1 w-full flex flex-col order-2 md:order-1 min-w-0">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">
            Revolutionary Music
          </h2>
          {orderedGroups.length === 0 ? (
            <div className="text-white/60 text-center py-8 w-full">
              No revolutionary music available
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {orderedGroups.map((groupName) => (
                <RevolutionaryMusicRow
                  key={groupName}
                  groupName={groupName}
                  items={groupsMap.get(groupName) ?? []}
                  playingItemId={playingItemId}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-full md:w-[300px] lg:w-[350px] flex-shrink-0 flex flex-col order-1 md:order-2">
          <LiveChannels />
        </div>
      </div>
    </section>
  );
}
