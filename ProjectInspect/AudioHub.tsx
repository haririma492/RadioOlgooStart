"use client";

import React from "react";
import AudioCategoryBar from "./AudioCategoryBar";
import AudioRow from "./AudioRow";
import LiveChannels from "../LiveChannels/LiveChannels";

export default function AudioHub() {
  return (
    <section className="w-full">
      {/* Audio Hub Main Content */}
      <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 items-stretch">
        {/* Audio Hub Section (Left - Takes more area) */}
        <div className="flex-1 w-full flex flex-col order-2 md:order-1">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Audio Hub</h2>
          <div className="flex gap-4 md:gap-6 lg:gap-8 overflow-visible flex-1" style={{ minHeight: 'calc(3 * 210.2px + 2 * 32px)' }}>
            {/* Category Bar (Left) */}
            <AudioCategoryBar />
            
            {/* Audio Rows (Right) - Constrained to show 2 cards on mobile, 5 on desktop */}
            <div 
              className="flex-1 space-y-6 md:space-y-8 min-w-0 overflow-visible max-w-[calc(2*171px+1*5.39px)] md:max-w-[calc(5*171px+4*5.39px)]" 
              style={{ 
                minHeight: 'calc(3 * 210.2px + 2 * 32px)'
              }}
            >
              <AudioRow category="Classic" />
              <AudioRow category="Modern" />
              <AudioRow category="Popup" />
            </div>
          </div>
        </div>

        {/* Live Channels Section (Right - Fixed width) */}
        <div className="w-full md:w-[300px] lg:w-[350px] flex-shrink-0 flex flex-col order-1 md:order-2">
          <LiveChannels />
        </div>
      </div>
    </section>
  );
}
