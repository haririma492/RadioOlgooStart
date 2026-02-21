"use client";

import React, { useMemo, useState } from "react";
import type { LiveItem } from "@/lib/youtubeLive";
import { youtubeEmbedUrl, youtubeThumbUrl } from "@/lib/youtubeLive";

type Props = {
  liveItems: LiveItem[]; // already filtered to only live channels
  maxWall?: number; // default 5
  title?: string; // optional section title
};

export default function LiveSection({ liveItems, maxWall = 5, title = "LIVE" }: Props) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const { wallItems, overflowItems, activeItem } = useMemo(() => {
    const items = Array.isArray(liveItems) ? liveItems : [];
    const active = activeVideoId ? items.find((x) => x.videoId === activeVideoId) : undefined;

    const wall = items.slice(0, Math.max(0, maxWall));
    const overflow = items.slice(Math.max(0, maxWall));

    return { wallItems: wall, overflowItems: overflow, activeItem: active };
  }, [liveItems, maxWall, activeVideoId]);

  const inFocus = !!activeVideoId;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold tracking-wide">{title}</div>
          <div className="text-xs opacity-70">
            {liveItems?.length ? `${liveItems.length} live` : "No live channels"}
          </div>
        </div>

        {inFocus && (
          <button
            className="text-sm px-3 py-1 rounded-lg border border-white/20 hover:border-white/40"
            onClick={() => setActiveVideoId(null)}
          >
            Back to Wall
          </button>
        )}
      </div>

      {/* Focus mode: only ONE player (with sound) */}
      {inFocus && activeItem ? (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
          <div className="aspect-video w-full">
            <iframe
              key={`focus-${activeItem.videoId}`}
              src={youtubeEmbedUrl(activeItem.videoId, { autoplay: true, mute: false })}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={`${activeItem.handle} live`}
            />
          </div>

          <div className="p-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{activeItem.handle}</span>
              <span className="opacity-70"> — playing with sound</span>
            </div>
            <a
              href={activeItem.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline opacity-90 hover:opacity-100"
            >
              Open on YouTube
            </a>
          </div>
        </div>
      ) : null}

      {/* Wall mode */}
      {!inFocus && (
        <div className="space-y-4">
          {/* Wall players (muted autoplay) */}
          {wallItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {wallItems.map((item) => (
                <div
                  key={`wall-${item.videoId}`}
                  className="rounded-2xl overflow-hidden border border-white/10 bg-black hover:border-white/25 transition"
                >
                  <div className="relative aspect-video w-full">
                    <div className="absolute z-10 top-2 left-2 px-2 py-1 rounded-md text-xs font-bold bg-red-600">
                      LIVE
                    </div>

                    <button
                      className="absolute z-10 bottom-2 right-2 px-3 py-1 rounded-lg text-sm border border-white/20 bg-black/40 hover:border-white/50"
                      onClick={() => setActiveVideoId(item.videoId)}
                      title="Play with sound"
                    >
                      Play
                    </button>

                    <iframe
                      key={`muted-${item.videoId}`}
                      src={youtubeEmbedUrl(item.videoId, { autoplay: true, mute: true })}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      title={`${item.handle} wall`}
                    />
                  </div>

                  <div className="p-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">{item.handle}</div>
                    <a
                      href={item.watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline opacity-80 hover:opacity-100"
                    >
                      YouTube
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Overflow: NOT streaming, big LIVE badge */}
          {overflowItems.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">More live channels</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {overflowItems.map((item) => {
                  const thumb = item.thumbnailUrl || youtubeThumbUrl(item.videoId);
                  return (
                    <div
                      key={`overflow-${item.videoId}`}
                      className="rounded-2xl overflow-hidden border border-white/10 bg-black hover:border-white/25 transition"
                    >
                      <div className="relative aspect-video w-full">
                        <img
                          src={thumb}
                          alt={`${item.handle} thumbnail`}
                          className="w-full h-full object-cover opacity-95"
                        />
                        <div className="absolute inset-0 bg-black/25" />

                        <div className="absolute top-3 left-3 px-3 py-2 rounded-xl text-sm font-extrabold bg-red-600">
                          LIVE
                        </div>

                        <button
                          className="absolute bottom-3 right-3 px-4 py-2 rounded-xl text-sm font-semibold border border-white/25 bg-black/40 hover:border-white/60"
                          onClick={() => setActiveVideoId(item.videoId)}
                        >
                          Play now
                        </button>
                      </div>

                      <div className="p-2 flex items-center justify-between">
                        <div className="text-sm font-semibold">{item.handle}</div>
                        <a
                          href={item.watchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline opacity-80 hover:opacity-100"
                        >
                          YouTube
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {wallItems.length === 0 && (
            <div className="rounded-2xl border border-white/10 p-6 opacity-80">
              No live channels right now.
            </div>
          )}
        </div>
      )}
    </section>
  );
}