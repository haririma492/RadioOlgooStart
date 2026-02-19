"use client";

import React, { useState, useEffect } from "react";

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** When API is ready: call with query and display results */
  onSearch?: (query: string) => void;
};

export default function SearchModal({
  isOpen,
  onClose,
  onSearch,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    setHasSearched(true);
    onSearch?.(q);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Backdrop - same as all modals */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(0, 0, 0, 0.35)",
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          padding: "1rem",
        }}
      >
        <div
          className="relative flex flex-col bg-[#1a1a1a] rounded-xl border border-white/10 max-w-2xl w-full mx-4 scrollbar-hide"
          style={{
            pointerEvents: "auto",
            maxHeight: "55vh",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - same as other modals */}
          <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4">
            <h2 className="text-white text-xl md:text-2xl font-semibold">Search</h2>
            <button
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
              aria-label="Close modal"
              type="button"
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                minHeight: "32px",
                backgroundColor: "transparent",
                border: "none",
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

          {/* Search form + results - scrollable, scrollbar hidden */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 scrollbar-hide">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search videos..."
                className="flex-1 rounded-lg border border-white/20 bg-black/40 text-white placeholder-white/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Search"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="px-4 py-2.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-sm font-medium transition-colors"
              >
                Search
              </button>
            </div>

            {/* Results area - API ready later */}
            <div className="rounded-lg border border-white/10 bg-black/20 min-h-[120px] p-4">
              {!hasSearched ? (
                <p className="text-white/60 text-sm">
                  Enter a search term and click Search. Results will appear here when the API is ready.
                </p>
              ) : (
                <p className="text-white/60 text-sm">
                  Search for &quot;{query.trim()}&quot; — results will load here when the search API is connected.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
