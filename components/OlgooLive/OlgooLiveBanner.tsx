"use client";

import { useEffect, useMemo, useState } from "react";
import OlgooLivePlayer from "./OlgooLivePlayer";

type StateResponse = {
  playState?: "playing" | "stopped";
  mediaUrl?: string;
  title?: string;
  startedAt?: string;
  updatedAt?: string;
  sourceScheduleId?: string;
  sourcePlaylistId?: string;

  url?: string;
  streamUrl?: string;
  playbackUrl?: string;

  configured?: boolean;
  isConfigured?: boolean;
  canPlay?: boolean;
  clickable?: boolean;

  status?: string;
  statusLabel?: string;
  message?: string;
  error?: string;
};

type Lang = "fa" | "en";

export default function OlgooLiveBanner() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [lastGoodState, setLastGoodState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [openPlayer, setOpenPlayer] = useState(false);
  const [lang, setLang] = useState<Lang>("fa");

  useEffect(() => {
    const root = document.getElementById("user-page");
    const dir = root?.getAttribute("dir");
    setLang(dir === "rtl" ? "fa" : "en");
  }, []);

  async function loadState() {
    setLoading(true);

    try {
      const response = await fetch(`/api/olgoo-live/state?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      const effectiveMediaUrl =
        data?.mediaUrl || data?.url || data?.streamUrl || data?.playbackUrl || "";

      const normalized: StateResponse = {
        ...data,
        mediaUrl: effectiveMediaUrl || undefined,
      };

      setState(normalized);

      if (effectiveMediaUrl) {
        setLastGoodState(normalized);
      }
    } catch (error) {
      console.error("OlgooLiveBanner loadState failed", error);

      // Do NOT destroy good state because of a temporary refresh glitch.
      if (!lastGoodState) {
        setState({
          configured: false,
          isConfigured: false,
          canPlay: false,
          clickable: false,
          status: "error",
          statusLabel: lang === "fa" ? "خطا" : "ERROR",
          message:
            lang === "fa"
              ? "خواندن وضعیت پخش زنده اُلگو ممکن نشد."
              : "Could not read Olgoo Live state.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
    const timer = window.setInterval(loadState, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const effectiveState = useMemo(() => {
    const currentMediaUrl =
      state?.mediaUrl || state?.url || state?.streamUrl || state?.playbackUrl || "";

    if (currentMediaUrl) return state;

    const fallbackMediaUrl =
      lastGoodState?.mediaUrl ||
      lastGoodState?.url ||
      lastGoodState?.streamUrl ||
      lastGoodState?.playbackUrl ||
      "";

    if (fallbackMediaUrl) return lastGoodState;

    return state;
  }, [state, lastGoodState]);

  const mediaUrl =
    effectiveState?.mediaUrl ||
    effectiveState?.url ||
    effectiveState?.streamUrl ||
    effectiveState?.playbackUrl ||
    "";

  const title =
    effectiveState?.title ||
    (lang === "fa" ? "شبکه زنده برند اُلگو" : "Olgoo branded live channel");

  const isConfigured = Boolean(mediaUrl);
  const isPlaying = effectiveState?.playState === "playing";
  const canPlay = isConfigured && isPlaying;

  const subtitle = isConfigured
    ? lang === "fa"
      ? "اُلگو لایو را انتخاب کنید تا پخش تلویزیونی برند اُلگو باز شود."
      : "Select Olgoo Live to open your branded TV stream."
    : lang === "fa"
    ? "پخش زنده اُلگو هنوز تنظیم نشده است."
    : "Olgoo Live is not configured yet.";

  const statusLabel = isConfigured
    ? isPlaying
      ? lang === "fa"
        ? "در حال پخش"
        : "ON AIR"
      : lang === "fa"
      ? "آماده"
      : "READY"
    : lang === "fa"
    ? "تنظیم نشده"
    : "NOT CONFIGURED";

  return (
    <section className="rounded-[28px] bg-gradient-to-r from-[#1b1200] via-black to-black p-6 shadow-2xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-4 inline-flex rounded-full border border-amber-500/40 px-6 py-3 text-sm font-bold uppercase tracking-[0.35em] text-amber-400">
            OLGOO LIVE
          </div>

          <h2 className={lang === "fa" ? "mb-3 text-4xl font-bold md:text-5xl" : "mb-3 text-3xl font-bold md:text-5xl"}>
            {title}
          </h2>

          <p className={lang === "fa" ? "mb-4 text-2xl text-white/85" : "mb-4 text-xl text-white/85"}>
            {subtitle}
          </p>

          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/55">
            {loading ? (lang === "fa" ? "در حال بارگذاری..." : "Loading…") : statusLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={loadState}
            className="rounded-3xl border border-white/15 bg-black/40 px-8 py-5 text-xl font-semibold text-white transition hover:bg-white/10"
          >
            {lang === "fa" ? "بازخوانی" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (canPlay) setOpenPlayer(true);
            }}
            disabled={!canPlay}
            className="rounded-3xl border border-amber-500/30 bg-amber-700 px-8 py-5 text-xl font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lang === "fa" ? "پخش اُلگو لایو" : "Play Olgoo Live"}
          </button>
        </div>
      </div>

      {openPlayer && mediaUrl && (
        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-white">{title}</div>

            <button
              type="button"
              onClick={() => setOpenPlayer(false)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
            >
              {lang === "fa" ? "بستن" : "Close"}
            </button>
          </div>

          <OlgooLivePlayer
            mediaUrl={mediaUrl}
            title={title}
            autoPlay
            controls
            muted={false}
          />
        </div>
      )}
    </section>
  );
}