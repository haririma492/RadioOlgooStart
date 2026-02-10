"use client";

import React from "react";

type VideoCategoryBarProps = {
  categories?: string[];
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
};

export default function VideoCategoryBar({
  categories = ["Political", "Military"],
  activeCategory,
  onCategoryChange,
}: VideoCategoryBarProps) {
  return (
    <div className="flex flex-col gap-6 md:gap-8 items-center justify-start">
      {categories.map((category) => (
        <div
          key={category}
          className="flex items-center justify-center"
          style={{
            height: '140px',
            width: 'fit-content',
          }}
        >
          <button
            onClick={() => onCategoryChange?.(category)}
            className={`text-white text-xl md:text-2xl font-normal transition-opacity whitespace-nowrap ${
              activeCategory === category ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              transform: 'rotate(90deg)',
              transformOrigin: 'center',
              letterSpacing: '0.05em',
            }}
          >
            {category}
          </button>
        </div>
      ))}
    </div>
  );
}
