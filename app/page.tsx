"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header/Header";
import HeroSection from "@/components/HeroSection/HeroSection";
import VideoHub from "@/components/VideoHub/VideoHub";
import AudioHub from "@/components/AudioHub/AudioHub";
import BreakingNewsBanner from "@/components/BreakingNews/BreakingNewsBanner";
import Footer from "@/components/Footer/Footer";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer/FloatingVideoPlayer";
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";
import LiveBlock from "@/components/LiveBlock/LiveBlock";
import type { OlgooLivePlayerType } from "@/components/OlgooLive/types";

type Lang = "fa" | "en";

const CALENDAR_LINK = "https://www.aryamehr.online/post/culturalcalendarofthe2585thiranianempire";

const translations = {
  fa: {
    videoHub: "گزیده نماهنگ",
    music: "موسیقی میهنی",
    breakingNews: "خبر فوری",
    english: "English",
    farsi: "فارسی",
    tehranTime: " در تهران زمان",
    morning: "بامداد",
    afternoon: "نیمروز",
    evening: "شام",
    timeWord: "زمان",
    inTehran: "در تهران",
    olgooLiveUnavailable: "پخش زنده اکنون در دسترس نیست.",
    calendarTitle: "گاهنامه",
    openInNewTab: "باز کردن در صفحهٔ جدید",
    close: "بستن",
  },
  en: {
    videoHub: "Video Archive",
    music: "Revolutionary Music",
    breakingNews: "Breaking News",
    english: "English",
    farsi: "فارسی",
    tehranTime: "Time in Tehran",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Night",
    timeWord: "Time",
    inTehran: "in Tehran",
    olgooLiveUnavailable: "Olgoo Live is not available right now.",
    calendarTitle: "Cultural Calendar",
    openInNewTab: "Open in New Tab",
    close: "Close",
  },
};

type PlayingVideo = {
  url: string;
  person?: string;
  title?: string;
  timestamp?: string;
  playerType?: OlgooLivePlayerType;
  sourceLabel?: string;
  isLive?: boolean;
};

function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function useLiveNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = window.setInterval(tick, 60_000);
    const delay = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const timeout = window.setTimeout(() => {
      tick();
    }, Math.max(0, delay));
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);
  return now;
}

function useLiveCalendarSegments(lang: Lang) {
  const now = useLiveNow();
  return useMemo(() => {
    if (!now) {
      return {
        dateLine: "",
        timeOnly: "",
        periodOnly: "",
        isReady: false,
      };
    }
    const weekdayFa = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      timeZone: "Asia/Tehran",
    }).format(now);
    const jalaliPartsFa = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran",
    }).formatToParts(now);
    const jalaliDayFa = jalaliPartsFa.find((p) => p.type === "day")?.value ?? "";
    const jalaliMonthFa = jalaliPartsFa.find((p) => p.type === "month")?.value ?? "";
    const jalaliYearFa = jalaliPartsFa.find((p) => p.type === "year")?.value ?? "";
    const gregorianPartsFa = new Intl.DateTimeFormat("fa-IR", {
      calendar: "gregory",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran",
    }).formatToParts(now);
    const gregorianDayFa = gregorianPartsFa.find((p) => p.type === "day")?.value ?? "";
    const gregorianMonthFa = gregorianPartsFa.find((p) => p.type === "month")?.value ?? "";
    const gregorianYearFa = gregorianPartsFa.find((p) => p.type === "year")?.value ?? "";
    const shahanshahiYear = 2584;
    const shahanshahiFa = `${toPersianDigits(shahanshahiYear)} (${jalaliYearFa})`;
const tehranHourFa = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran",
}).format(now);
    const hour24 = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Tehran",
      }).format(now)
    );
let periodFa = translations.fa.morning;

// 18:00 → 23:59  = شام
if (hour24 >= 18 && hour24 <= 23) {
  periodFa = "شام";
}

// 00:01 → 11:59 = بامداد
else if (hour24 >= 0 && hour24 < 12) {
  periodFa = "بامداد";
}

// 12:00 → 17:59 = نیمروز
else {
  periodFa = "نیمروز";
}

    const weekdayEn = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "Asia/Tehran",
    }).format(now);
    const jalaliPartsEn = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran",
    }).formatToParts(now);
    const jalaliDayEn = jalaliPartsEn.find((p) => p.type === "day")?.value ?? "";
    const jalaliMonthEn = jalaliPartsEn.find((p) => p.type === "month")?.value ?? "";
    const jalaliYearEn = jalaliPartsEn.find((p) => p.type === "year")?.value ?? "";
    const gregorianPartsEn = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran",
    }).formatToParts(now);
    const gregorianDayEn = gregorianPartsEn.find((p) => p.type === "day")?.value ?? "";
    const gregorianMonthEn = gregorianPartsEn.find((p) => p.type === "month")?.value ?? "";
    const gregorianYearEn = gregorianPartsEn.find((p) => p.type === "year")?.value ?? "";
    const shahanshahiEn = `${shahanshahiYear} (${jalaliYearEn})`;
    const tehranTimeEn = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Tehran",
    }).format(now);
    let periodEn = translations.en.morning;
    if (hour24 >= 12 && hour24 < 18) periodEn = translations.en.afternoon;
    if (hour24 >= 18 || hour24 < 5) periodEn = translations.en.evening;

    if (lang === "fa") {
      return {
        dateLine: `${weekdayFa} ${jalaliDayFa} - ${jalaliMonthFa} - ${shahanshahiFa}   ${gregorianDayFa} - ${gregorianMonthFa} - ${gregorianYearFa}`,
        timeOnly: tehranHourFa,
        periodOnly: periodFa,
        isReady: true,
      };
    }
    return {
      dateLine: `${weekdayEn} ${jalaliDayEn} - ${jalaliMonthEn} - ${shahanshahiEn}   ${gregorianDayEn} - ${gregorianMonthEn} - ${gregorianYearEn}`,
      timeOnly: tehranTimeEn,
      periodOnly: periodEn,
      isReady: true,
    };
  }, [lang, now]);
}

function TimePill({ value, invisible = false }: { value: string; invisible?: boolean }) {
  return (
    <div
      className="text-sm font-semibold md:text-base lg:text-lg"
      style={{
        display: "inline-flex",
        direction: "ltr",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: 0,
        margin: 0,
        width: "auto",
        minWidth: 0,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
      }}
    >
      <span
        className={invisible ? "invisible" : ""}
        style={{
          display: "inline-block",
          direction: "ltr",
          textAlign: "right",
          unicodeBidi: "embed",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CalendarModal({
  isOpen,
  onClose,
  lang,
}: {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  const t = translations[lang];

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/20" onClick={onClose}>
      <div
        className="absolute bottom-6 right-6 flex h-[68vh] w-[min(73rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d0d0d]/95 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
          <div className="text-base font-bold md:text-lg">{t.calendarTitle}</div>

          <div className="flex items-center gap-2">
            <a
              href={CALENDAR_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              {t.openInNewTab}
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              {t.close}
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-white">
          <iframe
            src={CALENDAR_LINK}
            title={t.calendarTitle}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
function TopCalendarBar({
  lang,
  onCalendarImageClick,
}: {
  lang: Lang;
  onCalendarImageClick: () => void;
}) {
  const isFa = lang === "fa";
  const t = translations[lang];
  const segments = useLiveCalendarSegments(lang);

  let faPrimaryDate = "";
  let faGregorianDate = "";

  if (isFa && segments.dateLine) {
    const parts = segments.dateLine.split(/\s{3,}/);
    faPrimaryDate = parts[0] ?? segments.dateLine;
    faGregorianDate = parts[1] ?? "";
  }

  const unifiedTextClass = "text-base md:text-lg lg:text-xl";
  const unifiedTextStyle: React.CSSProperties = {
    color: "#4ade80",
    fontWeight: 600,
  };

  return (
    <div className="mx-auto mb-6 w-full max-w-[1500px] px-4">
      <div className="relative rounded-2xl border border-white/10 bg-black/80 px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          aria-hidden="true"
          style={{
            transform: "translateX(-70px)",
          }}
        >
          <button
            type="button"
            onClick={onCalendarImageClick}
            className="pointer-events-auto group relative flex items-center justify-center rounded-2xl p-[6px] transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label={t.calendarTitle}
            title={t.calendarTitle}
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(2px)",
            }}
          >
            <img
              src="/images/Gaahnaameh3.png"
              alt={t.calendarTitle}
              className="h-20 w-auto rounded-lg object-contain md:h-24 lg:h-28"
              style={{
                boxShadow: "0 8px 18px rgba(0,0,0,0.38)",
              }}
            />
          </button>
        </div>

        <div
          className={[
            "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
            isFa ? "lg:flex-row-reverse" : "",
          ].join(" ")}
        >
          <div className="flex shrink-0 items-center justify-center lg:justify-start">
            <img
              src="/images/banner1.png"
              alt="Olgoo logo"
              className="h-20 w-20 rounded-full object-contain md:h-24 md:w-24"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallbackTried) {
                  target.dataset.fallbackTried = "1";
                  target.src = "/images/banner1.webp";
                }
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="mb-3 flex w-full items-center border-b border-white/10 pb-3"
              style={{
                direction: "rtl",
                justifyContent: "space-between",
              }}
            >
              {isFa ? (
                <>
                  <div
                    className={unifiedTextClass}
                    style={{
                      ...unifiedTextStyle,
                      textDecoration: "underline",
                      textUnderlineOffset: "4px",
                      whiteSpace: "nowrap",
                      marginRight: 0,
                      flexShrink: 0,
                    }}
                  >
                    گاهشمار
                  </div>

                  {segments.isReady ? (
                    <div
                      className="flex items-center flex-nowrap"
                      style={{
                        gap: "18px",
                        direction: "rtl",
                        justifyContent: "flex-start",
                        marginRight: "48px",
                        marginLeft: "auto",
                      }}
                    >
                      <div className={unifiedTextClass} style={unifiedTextStyle}>
                        <TimePill value={segments.timeOnly} />
                      </div>
                      <div className={unifiedTextClass} style={unifiedTextStyle}>
                        {segments.periodOnly}
                      </div>
                      <div className={unifiedTextClass} style={unifiedTextStyle}>
                        {t.inTehran}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center flex-nowrap"
                      style={{
                        gap: "18px",
                        direction: "rtl",
                        justifyContent: "flex-start",
                        marginRight: "48px",
                        marginLeft: "auto",
                      }}
                    >
                      <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                        <TimePill value="00:00" invisible />
                      </div>
                      <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                        {translations.fa.afternoon}
                      </div>
                      <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                        {t.inTehran}
                      </div>
                    </div>
                  )}
                </>
              ) : segments.isReady ? (
                <div
                  className="flex items-center justify-end flex-nowrap"
                  style={{ gap: "18px", width: "100%" }}
                >
                  <div className={unifiedTextClass} style={unifiedTextStyle}>
                    {t.timeWord}
                  </div>
                  <div className={unifiedTextClass} style={unifiedTextStyle}>
                    <TimePill value={segments.timeOnly} />
                  </div>
                  <div className={unifiedTextClass} style={unifiedTextStyle}>
                    {segments.periodOnly}
                  </div>
                  <div className={unifiedTextClass} style={unifiedTextStyle}>
                    {t.inTehran}
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center justify-end flex-nowrap"
                  style={{ gap: "18px", width: "100%" }}
                >
                  <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                    {t.timeWord}
                  </div>
                  <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                    <TimePill value="00:00" invisible />
                  </div>
                  <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                    {translations.en.afternoon}
                  </div>
                  <div className={`${unifiedTextClass} invisible`} style={unifiedTextStyle}>
                    {t.inTehran}
                  </div>
                </div>
              )}
            </div>

            <div className="flex w-full justify-end">
              <div
                className="w-full text-right min-h-[2.25rem]"
                style={isFa ? { paddingRight: "110px" } : undefined}
              >
                {segments.isReady ? (
                  isFa ? (
                    <>
{(() => {
  const match = faPrimaryDate.match(/^(.*?)(\s*\([^)]+\))$/);
  if (!match) {
    return (
      <span className={unifiedTextClass} style={unifiedTextStyle}>
        {faPrimaryDate}
      </span>
    );
  }

  return (
    <>
      <span className={unifiedTextClass} style={unifiedTextStyle}>
        {match[1]}
      </span>
      <span
        className="text-sm md:text-base lg:text-lg"
        style={{ ...unifiedTextStyle, fontWeight: 500 }}
      >
        {match[2]}
      </span>
    </>
  );
})()}
                      {faGregorianDate ? (
                        <>
                          <span style={{ display: "inline-block", width: "3ch" }} />
                          <span className={unifiedTextClass} style={unifiedTextStyle}>
                            {faGregorianDate}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className={unifiedTextClass} style={unifiedTextStyle}>
                      {segments.dateLine}
                    </span>
                  )
                ) : (
                  <span className="invisible">loading date line</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePageContent() {
  const [playingVideo, setPlayingVideo] = useState<PlayingVideo | null>(null);
  const { activePlayback, setActivePlayback } = usePlayback();
  const [lang, setLang] = useState<Lang>("fa");
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const t = translations[lang];
  const isFa = lang === "fa";

  useEffect(() => {
    if (activePlayback && !["floating", "olgoo-live"].includes(activePlayback.source)) {
      setPlayingVideo(null);
    }
  }, [activePlayback]);

  const handleVideoPlay = (video: PlayingVideo) => {
    setActivePlayback("floating", video.url);
    setPlayingVideo(video);
  };

  const handleClosePlayer = () => {
    setActivePlayback(null);
    setPlayingVideo(null);
  };
const sectionTitleClass = isFa
  ? "mb-3 text-3xl md:text-4xl font-normal tracking-normal"
  : "mb-3 text-xl font-bold tracking-normal"; 
  
  const panelClass = "mb-6 rounded-2xl bg-black/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]";

  return (
    <div
      id="user-page"
      dir={isFa ? "rtl" : "ltr"}
      className="relative min-h-screen overflow-x-hidden text-white"
      style={{ backgroundColor: "#434343" }}
    >
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: "#434343" }} />
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/full-site-background.webp')",
          backgroundSize: "cover",
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed inset-0 -z-[9]" style={{ backgroundColor: "rgba(22, 28, 36, 0.18)" }} />

<div className="relative z-10 bg-transparent">
  <Header lang={lang} setLang={setLang} />
</div>

<div className="relative z-0 bg-transparent pt-4">
  <TopCalendarBar
    lang={lang}
    onCalendarImageClick={() => setIsCalendarModalOpen(true)}
  />
</div>

      <div className="relative z-0 bg-transparent">
        <main className="mx-auto w-full max-w-[1500px] px-4 py-2 bg-transparent">
          <section className={`${panelClass} p-3`}>
            <HeroSection />
          </section>


          <section className={`${panelClass} border border-white/10 p-4`}>
            <LiveBlock />
          </section>

          <section
            id="video-hub"
            className={`${panelClass} scroll-mt-24 border border-white/10 p-4`}
          >
            <h2 className={sectionTitleClass}>{t.videoHub}</h2>
            <VideoHub
              onVideoClick={(video) => {
                handleVideoPlay({
                  url: video.url,
                  person: video.person || video.personName,
                  title: video.title,
                  timestamp: video.createdAt,
                  playerType: "video",
                  sourceLabel: t.videoHub,
                  isLive: false,
                });
              }}
            />
          </section>

          <section
            id="revolutionary-music"
            className={`${panelClass} scroll-mt-24 border border-white/10 p-4`}
          >
            <h2 className={sectionTitleClass}>{t.music}</h2>
            <AudioHub />
          </section>

          <section className={`${panelClass} p-3`}>
            <h2 className={`${sectionTitleClass} text-red-400`}>{t.breakingNews}</h2>
            <BreakingNewsBanner />
          </section>
        </main>

        <div className="bg-transparent">
          <Footer />
        </div>
      </div>

      <FloatingVideoPlayer
        isOpen={!!playingVideo}
        onClose={handleClosePlayer}
        videoUrl={playingVideo?.url}
        person={playingVideo?.person}
        title={playingVideo?.title}
        timestamp={playingVideo?.timestamp}
        playerType={playingVideo?.playerType}
        sourceLabel={playingVideo?.sourceLabel}
        isLive={playingVideo?.isLive}
      />

      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <PlaybackProvider>
      <HomePageContent />
    </PlaybackProvider>
  );
}