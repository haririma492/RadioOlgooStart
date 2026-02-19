"use client";

import React, { useRef, useState, useEffect } from "react";

export type LiveCard = {
  kind: "youtube" | "external";
  id: string;
  title: string;
  openUrl: string;
  state: "LIVE" | "OFFLINE" | "ERROR";
  embedUrl: string | null;
  st?: {
    state: string;
    reason?: string;
    debug?: { errors?: string[] };
  };
};

type LiveSectionProps = {
  cards: LiveCard[];
  loading?: boolean;
  onOpenMiniWindow: (url: string, title: string) => void;
};

const CARD_WIDTH_CLASS = "w-[260px] md:w-[280px]";
const GAP_PX_MD = 24;
const GAP_PX = 16;

export default function LiveSection({
  cards,
  loading = false,
  onOpenMiniWindow,
}: LiveSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNextButton, setShowNextButton] = useState(true);
  const [showPrevButton, setShowPrevButton] = useState(false);

  const checkScrollPosition = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const hasScroll = container.scrollWidth > container.clientWidth;
    const isAtEnd =
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    const isAtStart = container.scrollLeft <= 10;
    setShowNextButton(hasScroll && !isAtEnd);
    setShowPrevButton(hasScroll && !isAtStart);
  };

  const handleNext = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const firstCard = container.querySelector(
      '[class*="flex-shrink-0"]'
    ) as HTMLElement;
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth;
      const gap = typeof window !== "undefined" && window.innerWidth >= 768 ? GAP_PX_MD : GAP_PX;
      container.scrollTo({
        left: container.scrollLeft + cardWidth + gap,
        behavior: "smooth",
      });
    }
  };

  const handlePrev = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const firstCard = container.querySelector(
      '[class*="flex-shrink-0"]'
    ) as HTMLElement;
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth;
      const gap = typeof window !== "undefined" && window.innerWidth >= 768 ? GAP_PX_MD : GAP_PX;
      container.scrollTo({
        left: container.scrollLeft - cardWidth - gap,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const checkWithRAF = () => requestAnimationFrame(checkScrollPosition);
    checkWithRAF();
    const timeoutId = setTimeout(checkWithRAF, 200);
    container.addEventListener("scroll", checkScrollPosition);
    window.addEventListener("resize", checkWithRAF);
    const ro = new ResizeObserver(checkWithRAF);
    ro.observe(container);
    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkWithRAF);
      ro.disconnect();
    };
  }, [cards]);

  const isEmpty = cards.length === 0;

  return (
    <section className="mb-10">
      <div className="flex items-center overflow-visible">
        <div
          className="flex-shrink-0 flex items-center justify-center w-[56px] md:w-[64px]"
          style={{ minHeight: "180px" }}
        >
          <span
            className="text-white text-xl md:text-2xl font-normal opacity-80 whitespace-nowrap"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              letterSpacing: "0.05em",
            }}
          >
            LIVE
          </span>
        </div>
        <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-5 lg:p-6 pb-8 md:pb-10 relative">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto scroll-smooth gap-4 md:gap-6 -mx-1 px-1 pb-4 scrollbar-modern"
            style={{ scrollBehavior: "smooth" }}
          >
            {isEmpty ? (
              <div className="text-white/60 text-center py-4 w-full">
                {loading ? "Checking live status..." : "No live channels."}
              </div>
            ) : (
              cards.map((card) => {
                const isLive = card.state === "LIVE";
                const isExternal = card.kind === "external";
                const externalLive = isExternal && isLive;

                const cardClass = (() => {
                  if (externalLive)
                    return "bg-black/45 border border-white/15 shadow-lg backdrop-blur-sm ring-1 ring-white/20";
                  if (isExternal && !isLive)
                    return "bg-black/20 border border-white/10 opacity-60 grayscale";
                  return isLive
                    ? "bg-black/35 border border-white/10 shadow-lg backdrop-blur-sm"
                    : "bg-black/20 border border-white/10 opacity-70 grayscale";
                })();

                return (
                  <div
                    key={`${card.kind}:${card.id}`}
                    className={`flex-shrink-0 ${CARD_WIDTH_CLASS} rounded-2xl overflow-hidden ${cardClass}`}
                  >
                    <div className="px-3 py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-sm">
                        {card.title}
                        {isLive && (
                          <span className="ml-2 text-[11px] text-white/80">
                            ● LIVE
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenMiniWindow(card.openUrl, card.title)}
                      className={[
                        "text-[11px] px-2 py-1 rounded-full border",
                        externalLive
                          ? "bg-white/15 hover:bg-white/20 border-white/20"
                          : "bg-white/10 hover:bg-white/15 border-white/10",
                      ].join(" ")}
                      title="Open mini window"
                    >
                      Open
                    </button>
                  </div>

                  <div
                    className="w-full bg-black"
                    style={{ aspectRatio: "16 / 7.5" }}
                  >
                    {card.kind === "youtube" && isLive && card.embedUrl ? (
                      <iframe
                        className="w-full h-full"
                        src={`${card.embedUrl}?autoplay=1&mute=1&playsinline=1&rel=0`}
                        title={card.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center px-4">
                    {isExternal && externalLive ? (
                      <div className="w-full">
                        <div className="text-sm font-semibold mb-2">
                          Broadcast is LIVE
                        </div>
                        <button
                          onClick={() =>
                            onOpenMiniWindow(card.openUrl, card.title)
                          }
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/25 bg-white/15 hover:bg-white/20 shadow-md"
                          title="Open live"
                        >
                          <span className="text-base">▶</span>
                          <span className="font-semibold">LIVE</span>
                        </button>
                        <div className="mt-2 text-xs text-white/75">
                          Opens in a mini window (this source can’t be embedded
                          here).
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-semibold mb-1">
                          {card.state === "ERROR"
                            ? "Unavailable"
                            : "Offline"}
                        </div>

                        {card.kind === "youtube" && card.state === "ERROR" ? (
                          <div className="text-xs text-white/70">
                            {card.st?.debug?.errors?.[0] ||
                              card.st?.reason ||
                              "Check server logs for [youtube-status]."}
                          </div>
                        ) : (
                          <div className="text-xs text-white/70">
                            Moves left and plays automatically when live.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                  </div>
                </div>
                );
              })
            )}
          </div>

          {!isEmpty && showPrevButton && (
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
              aria-label="Previous"
              type="button"
            >
              <img
                src="/svg/nexticon.svg"
                alt="Previous"
                className="w-4 h-4 md:w-5 md:h-5 rotate-180"
              />
            </button>
          )}

          {!isEmpty && showNextButton && (
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white rounded-full p-1.5 md:p-2 hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
              aria-label="Next"
              type="button"
            >
              <img
                src="/svg/nexticon.svg"
                alt="Next"
                className="w-4 h-4 md:w-5 md:h-5"
              />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
