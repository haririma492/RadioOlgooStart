"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { LiveItem } from "@/lib/youtubeLive";
import { appendEmbedParams, youtubeEmbedUrl } from "@/lib/youtubeLive";

const VALID_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

function getEmbedSrc(
  item: LiveItem,
  opts: { autoplay: boolean; mute: boolean }
): string {
  if (item.embedUrl) return appendEmbedParams(item.embedUrl, opts);
  if (VALID_VIDEO_ID.test(item.videoId)) return youtubeEmbedUrl(item.videoId, opts);
  return "";
}

type Props = {
  liveItems: LiveItem[];
  maxWall?: number;
  title?: string;
};

export default function LiveSection({
  liveItems,
  maxWall: _maxWall,
  title = "LIVE",
}: Props) {
  const [activeInlineVideoId, setActiveInlineVideoId] = useState<string | null>(null);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);

  const { allItems, activeInlineItem, modalItem } = useMemo(() => {
    const items = Array.isArray(liveItems) ? liveItems : [];
    const inlineItem = activeInlineVideoId
      ? items.find((x) => x.videoId === activeInlineVideoId)
      : undefined;
    const currentModalItem = modalVideoId
      ? items.find((x) => x.videoId === modalVideoId)
      : undefined;

    return {
      allItems: items,
      activeInlineItem: inlineItem,
      modalItem: currentModalItem,
    };
  }, [liveItems, activeInlineVideoId, modalVideoId]);

  useEffect(() => {
    if (!modalVideoId) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalVideoId(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalVideoId]);

  return (
    <section className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold tracking-wide">{title}</div>
          <div className="text-xs opacity-70">
            {liveItems?.length ? `${liveItems.length} live` : "No live channels"}
          </div>
        </div>
      </div>

      <div className="w-full">
        {allItems.length > 0 ? (
          <div className="scrollbar-modern -mx-1 overflow-x-auto overflow-y-hidden px-1 pb-2">
            <div className="flex gap-3" style={{ scrollBehavior: "smooth" }}>
              {allItems.map((item) => {
                const isInlineActive = activeInlineItem?.videoId === item.videoId;
                const cardSrc = getEmbedSrc(item, {
                  autoplay: true,
                  mute: !isInlineActive,
                });

                return (
                  <div
                    key={`card-${item.videoId}`}
                    className="w-[300px] flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black transition hover:border-white/25 sm:w-[340px]"
                  >
                    <div
                      className="relative aspect-video w-full cursor-pointer"
                      onClick={() => setActiveInlineVideoId(item.videoId)}
                      onDoubleClick={() => setModalVideoId(item.videoId)}
                      title="Click to play here, double-click to open larger view"
                    >
                      <div className="absolute top-2 left-2 z-10 rounded bg-red-600 px-2 py-1 text-xs font-bold">
                        LIVE
                      </div>

                      {isInlineActive ? (
                        <div className="absolute top-2 right-2 z-10 rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white border border-white/20">
                          SOUND ON
                        </div>
                      ) : (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                          <div className="rounded-full bg-black/55 p-3 border border-white/20">
                            <svg
                              width="28"
                              height="28"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.9" />
                              <path d="M10 8L16 12L10 16V8Z" fill="#212B36" />
                            </svg>
                          </div>
                        </div>
                      )}

                      <iframe
                        key={`${isInlineActive ? "active" : "preview"}-${item.videoId}`}
                        src={cardSrc}
                        className="h-full w-full"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        title={`${item.handle} live`}
                      />
                    </div>

                    <div className="flex min-w-0 items-center justify-between p-2">
                      <div className="truncate text-sm font-semibold">{item.handle}</div>
                      <a
                        href={item.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs underline opacity-80 hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        YouTube
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 p-6 opacity-80">
            No live channels right now.
          </div>
        )}
      </div>

      {modalItem ? (
        <div
          className="fixed inset-0 z-[220] bg-black/70 p-4"
          onClick={() => setModalVideoId(null)}
        >
          <div
            className="absolute left-1/2 top-1/2 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <div className="text-sm font-semibold">{modalItem.handle}</div>
              <button
                type="button"
                onClick={() => setModalVideoId(null)}
                className="rounded-lg border border-white/20 px-3 py-1 text-sm hover:border-white/40"
              >
                Close
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              <iframe
                key={`modal-${modalItem.videoId}`}
                src={getEmbedSrc(modalItem, { autoplay: true, mute: false })}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={`${modalItem.handle} live modal`}
              />
            </div>

            <div className="flex items-center justify-between p-3">
              <div className="text-sm opacity-80">Playing with sound</div>
              <a
                href={modalItem.watchUrl}
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
    </section>
  );
}