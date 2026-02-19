"use client";

import React, { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getThreeCalendars, getWeekdayWithMiddlePersian, type ThreeCalendars } from "@/lib/dateCalendars";

type DateDisplayProps = {
  date: Date;
};

const SEGMENTS: { key: keyof ThreeCalendars; label: string }[] = [
  { key: "shamsi", label: "Shamsi (Solar Hijri)" },
  { key: "georgianFarsi", label: "Georgian (Farsi months)" },
  { key: "shahanshahi", label: "Shahanshahi" },
];

const SEP = "  │  ";

type TooltipState = {
  label: string;
  text: string;
  x: number;
  y: number;
} | null;

function DateSegment({
  label,
  text,
  onHover,
}: {
  label: string;
  text: string;
  onHover: (label: string, text: string, rect: DOMRect) => void;
}) {
  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      onHover(label, text, e.currentTarget.getBoundingClientRect());
    },
    [label, text, onHover]
  );
  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (label) onHover(label, text, e.currentTarget.getBoundingClientRect());
    },
    [label, text, onHover]
  );
  const handleLeave = useCallback(() => {
    onHover("", "", new DOMRect());
  }, [onHover]);

  return (
    <span
      className="date-strip-segment font-farsi relative inline-block px-5 py-1.5 cursor-default text-white"
      dir="ltr"
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ fontSize: "1.125rem", lineHeight: 1.5, unicodeBidi: "isolate", direction: "ltr" }}
    >
      {text}
    </span>
  );
}

function TooltipPortal({ state }: { state: TooltipState }) {
  if (!state || typeof document === "undefined") return null;

  const tooltip = (
    <div
      className="fixed z-[9999] px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-2xl border border-gray-600 font-farsi text-right max-w-[20rem]"
      style={{
        left: state.x,
        top: state.y - 8,
        transform: "translate(-50%, -100%)",
      }}
      role="tooltip"
    >
      <div className="block text-amber-300/95 text-xs font-semibold mb-1.5 uppercase tracking-wide">
        {state.label}
      </div>
      <div className="block text-white">{state.text}</div>
    </div>
  );

  return createPortal(tooltip, document.body);
}

export default function DateDisplay({ date }: DateDisplayProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const handleSegmentHover = useCallback(
    (label: string, text: string, rect: DOMRect) => {
      if (!label) {
        setTooltip(null);
        return;
      }
      setTooltip({
        label,
        text,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    []
  );

  const calendars = useMemo<ThreeCalendars>(
    () => getThreeCalendars(date),
    [date.getTime()]
  );
  const weekdayText = useMemo(
    () => getWeekdayWithMiddlePersian(date),
    [date.getTime()]
  );

  const oneBlock = (
    <>
      <DateSegment
        label="Weekday"
        text={weekdayText}
        onHover={handleSegmentHover}
      />
      {SEP}
      {SEGMENTS.map(({ key, label }) => (
        <React.Fragment key={key}>
          <DateSegment
            label={label}
            text={calendars[key]}
            onHover={handleSegmentHover}
          />
          {key !== "shahanshahi" && SEP}
        </React.Fragment>
      ))}
    </>
  );

  return (
    <>
      <div
        className="w-full overflow-x-hidden"
        aria-label={[weekdayText, calendars.shamsi, calendars.georgianFarsi, calendars.shahanshahi].join(" ")}
      >
        <div
          className="date-strip font-farsi text-white whitespace-nowrap animate-date-strip flex items-center"
          dir="ltr"
          style={{ width: "max-content", fontSize: "1.125rem", lineHeight: 1.5, direction: "ltr", unicodeBidi: "isolate" }}
        >
          {oneBlock}
          <span className="px-2 text-gray-500 select-none">{SEP}</span>
          {oneBlock}
          <span className="px-2 text-gray-500 select-none">{SEP}</span>
          {oneBlock}
        </div>
      </div>
      {typeof document !== "undefined" && (
        <TooltipPortal state={tooltip} />
      )}
    </>
  );
}
