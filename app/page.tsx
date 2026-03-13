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

const translations = {
  fa: {
    videoHub: "آرشیو ویدئو",
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
    olgooLiveUnavailable: "پخش اُلگو لایو اکنون در دسترس نیست.",
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
    const delay =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();

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
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
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
    if (hour24 >= 12 && hour24 < 18) periodFa = translations.fa.afternoon;
    if (hour24 >= 18 || hour24 < 5) periodFa = translations.fa.evening;

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
      className="text-xl font-semibold md:text-2xl"
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

function TopCalendarBar({ lang }: { lang: Lang }) {
  const isFa = lang === "fa";
  const t = translations[lang];
  const segments = useLiveCalendarSegments(lang);

  return (
    <div className="mx-auto mb-6 w-full max-w-[1500px] px-4">
      <div className="rounded-2xl border border-white/10 bg-black/80 px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
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
                direction: isFa ? "rtl" : "ltr",
                justifyContent: "flex-end",
              }}
            >
              {segments.isReady ? (
                isFa ? (
                  <div
                    className="flex items-center justify-end flex-nowrap"
                    style={{ gap: "18px", width: "100%" }}
                  >
                    <div className="text-lg font-bold md:text-xl">{t.timeWord}</div>
                    <div className="text-lg font-bold md:text-xl">{t.inTehran}</div>
                    <TimePill value={segments.timeOnly} />
                    <div className="text-lg font-bold md:text-xl">{segments.periodOnly}</div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-end flex-nowrap"
                    style={{ gap: "18px", width: "100%" }}
                  >
                    <div className="text-base font-bold md:text-lg">{t.timeWord}</div>
                    <TimePill value={segments.timeOnly} />
                    <div className="text-base font-bold md:text-lg">{segments.periodOnly}</div>
                    <div className="text-base font-bold md:text-lg">{t.inTehran}</div>
                  </div>
                )
              ) : (
                isFa ? (
                  <div
                    className="flex items-center justify-end flex-nowrap"
                    style={{ gap: "18px", width: "100%" }}
                  >
                    <div className="text-lg font-bold md:text-xl invisible">{t.timeWord}</div>
                    <div className="text-lg font-bold md:text-xl invisible">{t.inTehran}</div>
                    <TimePill value="00:00" invisible />
                    <div className="text-lg font-bold md:text-xl invisible">{translations.fa.afternoon}</div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-end flex-nowrap"
                    style={{ gap: "18px", width: "100%" }}
                  >
                    <div className="text-base font-bold md:text-lg invisible">{t.timeWord}</div>
                    <TimePill value="00:00" invisible />
                    <div className="text-base font-bold md:text-lg invisible">{translations.en.afternoon}</div>
                    <div className="text-base font-bold md:text-lg invisible">{t.inTehran}</div>
                  </div>
                )
              )}
            </div>

            <div className="flex w-full justify-end">
              <div
                className={
                  isFa
                    ? "w-full text-right text-lg font-semibold md:text-xl lg:text-2xl min-h-[2.25rem]"
                    : "w-full text-right text-base font-semibold md:text-lg lg:text-xl min-h-[2.25rem]"
                }
              >
                {segments.isReady ? (
                  segments.dateLine
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
    ? "mb-3 text-2xl font-bold tracking-normal"
    : "mb-3 text-xl font-bold tracking-normal";

  const panelClass =
    "mb-6 rounded-2xl bg-black/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]";

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

      <div
        className="fixed inset-0 -z-[9]"
        style={{ backgroundColor: "rgba(22, 28, 36, 0.18)" }}
      />

      <div className="relative z-10 bg-transparent">
        <Header />
      </div>

      <div className="relative z-0 bg-transparent">
        <TopCalendarBar lang={lang} />
      </div>

      <div className="relative z-0 bg-transparent">
        <main className="mx-auto w-full max-w-[1500px] px-4 py-2 bg-transparent">
          <section className={`${panelClass} p-3`}>
            <HeroSection />
          </section>

          <div className="mb-4 flex items-center justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 p-1">
              <button
                type="button"
                onClick={() => setLang("fa")}
                className={[
                  "rounded-full px-5 py-2 font-semibold transition",
                  isFa
                    ? "bg-white text-black shadow"
                    : "bg-transparent text-white/80 hover:bg-white/10",
                  "text-base md:text-lg",
                ].join(" ")}
              >
                {t.farsi}
              </button>

              <button
                type="button"
                onClick={() => setLang("en")}
                className={[
                  "rounded-full px-5 py-2 font-semibold transition",
                  !isFa
                    ? "bg-white text-black shadow"
                    : "bg-transparent text-white/80 hover:bg-white/10",
                  "text-base md:text-lg",
                ].join(" ")}
              >
                {t.english}
              </button>
            </div>
          </div>

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