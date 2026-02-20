"use client";

import React, { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getThreeCalendars,
  getWeekdayWithMiddlePersian,
  getShamsiParts,
  getGeorgianFarsiParts,
  getShahanshahiParts,
  type ThreeCalendars,
  type CalendarParts,
} from "@/lib/dateCalendars";

type DateDisplayProps = {
  date: Date;
};

const SEP = "  │  ";
const MARQUEE_BLOCK_REPEAT = 2;

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
  const handleLeave = useCallback(() => {
    onHover("", "", new DOMRect());
  }, [onHover]);

  return (
    <span
      className="date-strip-segment font-farsi relative inline-block px-5 py-1.5 cursor-default text-white"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ fontSize: "1.125rem", lineHeight: 1.5 }}
    >
      {text}
    </span>
  );
}

function DatePartsSegment({
  label,
  parts,
  onHover,
}: {
  label: string;
  parts: CalendarParts;
  onHover: (label: string, text: string, rect: DOMRect) => void;
}) {
  const fullText = `${parts.day} · ${parts.month} · ${parts.year}`;
  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      onHover(label, fullText, e.currentTarget.getBoundingClientRect());
    },
    [label, fullText, onHover]
  );
  const handleLeave = useCallback(() => {
    onHover("", "", new DOMRect());
  }, [onHover]);

  return (
    <span
      className="date-strip-segment font-farsi relative inline-flex items-center px-5 py-1.5 cursor-default text-white"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      dir="ltr"
      style={{ fontSize: "1.125rem", lineHeight: 1.5, direction: "ltr", unicodeBidi: "isolate" }}
    >
      <span>{parts.year}</span>
      <span className="px-2 text-gray-300">·</span>
      <span>{parts.month}</span>
      <span className="px-2 text-gray-300">·</span>
      <span>{parts.day}</span>
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
  const shamsiParts = useMemo(() => getShamsiParts(date), [date.getTime()]);
  const georgianParts = useMemo(() => getGeorgianFarsiParts(date), [date.getTime()]);
  const shahanshahiParts = useMemo(() => getShahanshahiParts(date), [date.getTime()]);

  const renderDateBlock = (keyPrefix: string) => (
    <React.Fragment key={keyPrefix}>
      <DateSegment
        label="Weekday"
        text={weekdayText}
        onHover={handleSegmentHover}
      />
      {SEP}
      <DatePartsSegment label="Shamsi (Solar Hijri)" parts={shamsiParts} onHover={handleSegmentHover} />
      {SEP}
      <DatePartsSegment label="Georgian (Farsi months)" parts={georgianParts} onHover={handleSegmentHover} />
      {SEP}
      <DatePartsSegment label="Shahanshahi" parts={shahanshahiParts} onHover={handleSegmentHover} />
    </React.Fragment>
  );

  const renderMarqueeSequence = (sequencePrefix: string) =>
    Array.from({ length: MARQUEE_BLOCK_REPEAT }).map((_, idx) => (
      <React.Fragment key={`${sequencePrefix}-${idx}`}>
        {renderDateBlock(`${sequencePrefix}-block-${idx}`)}
        {idx < MARQUEE_BLOCK_REPEAT - 1 && (
          <span className="px-2 text-gray-500 select-none">{SEP}</span>
        )}
      </React.Fragment>
    ));

  return (
    <>
      <div
        className="w-full overflow-hidden"
        aria-label={[weekdayText, calendars.shamsi, calendars.georgianFarsi, calendars.shahanshahi].join(" ")}
      >
        <div
          className="date-strip font-farsi text-white whitespace-nowrap animate-date-strip flex items-center"
          dir="ltr"
          style={{
            width: "max-content",
            fontSize: "1.125rem",
            lineHeight: 1.5,
            direction: "ltr",
            unicodeBidi: "isolate",
            willChange: "transform",
          }}
        >
          <div className="flex items-center shrink-0 pr-4">
            {renderMarqueeSequence("seq-a")}
          </div>
          <div className="flex items-center shrink-0 pr-4" aria-hidden="true">
            {renderMarqueeSequence("seq-b")}
          </div>
        </div>
      </div>
      {typeof document !== "undefined" && (
        <TooltipPortal state={tooltip} />
      )}
    </>
  );
}
