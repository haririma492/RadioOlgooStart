"use client";

import React, { useMemo, useState } from "react";
import type { LiveItem } from "@/lib/youtubeLive";
import { youtubeEmbedUrl } from "@/lib/youtubeLive";

type Props = {
  liveItems: LiveItem[]; // already filtered to only live channels
  maxWall?: number; // unused; kept for API compatibility
  title?: string; // optional section title
};

export default function LiveSection({ liveItems, maxWall: _maxWall, title = "LIVE" }: Props) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const { allItems, activeItem } = useMemo(() => {
    const items = Array.isArray(liveItems) ? liveItems : [];
    const active = activeVideoId ? items.find((x) => x.videoId === activeVideoId) : undefined;
    return { allItems: items, activeItem: active };
  }, [liveItems, activeVideoId]);

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

      {/* Focus mode: only ONE player (with sound); constrained width so it doesn't dominate the page */}
      {inFocus && activeItem ? (
        <div className="max-w-2xl mx-auto mb-4">
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
        </div>
      ) : null}

      {/* Wall mode: single horizontal scroll row of smaller cards */}
      {!inFocus && (
        <div className="w-full">
          {allItems.length > 0 ? (
            <div className="overflow-x-auto overflow-y-hidden pb-2 scrollbar-modern -mx-1 px-1">
              <div className="flex gap-3" style={{ scrollBehavior: "smooth" }}>
                {allItems.map((item) => (
                  <div
                    key={`card-${item.videoId}`}
                    className="flex-shrink-0 w-[300px] sm:w-[340px] rounded-xl overflow-hidden border border-white/10 bg-black hover:border-white/25 transition"
                  >
                    <div className="relative w-full aspect-video">
                      <div className="absolute z-10 top-2 left-2 px-2 py-1 rounded text-xs font-bold bg-red-600">
                        LIVE
                      </div>

                      <iframe
                        key={`muted-${item.videoId}`}
                        src={youtubeEmbedUrl(item.videoId, { autoplay: true, mute: true })}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        title={`${item.handle} live`}
                      />
                    </div>

                    <div className="p-2 flex items-center justify-between min-w-0">
                      <div className="text-sm font-semibold truncate">{item.handle}</div>
                      <a
                        href={item.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline opacity-80 hover:opacity-100 shrink-0"
                      >
                        YouTube
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 p-6 opacity-80">
              No live channels right now.
            </div>
          )}
        </div>
      )}
    </section>
  );
}