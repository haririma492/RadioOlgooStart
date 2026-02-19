"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header/Header";
import VideoHub from "@/components/VideoHub/VideoHub";
import AudioHub from "@/components/AudioHub/AudioHub";
import VideoSubmissionForm from "@/components/Forms/VideoSubmissionForm";
import SocialLinksForm from "@/components/Forms/SocialLinksForm";
import BreakingNewsBanner from "@/components/BreakingNews/BreakingNewsBanner";
import Footer from "@/components/Footer/Footer";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer/FloatingVideoPlayer";
import LiveSection from "@/components/LiveSection/LiveSection";
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";

type PlayingVideo = {
  url: string;
  person?: string;
  title?: string;
  timestamp?: string;
};

type LiveRow = {
  PK: string;
  url: string;
  title?: string;
  section?: string;
  group?: string;
  active?: boolean;
};

type YTLiveResult = {
  handle: string;
  isLive: boolean;
  videoId?: string;
  title?: string;
  error?: string;
};

function extractHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return s.replace(/^@/, "");

  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return m[1];

  return null;
}

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url || "");
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
  return (
    <iframe
      className="w-full h-full rounded-xl"
      src={src}
      title="Live video"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

function HomePageContent() {
  const [playingVideo, setPlayingVideo] = useState<PlayingVideo | null>(null);
  const { activePlayback, setActivePlayback } = usePlayback();

  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string>("");

  const lastGoodRef = useRef<Record<string, { at: number; data: YTLiveResult }>>(
    {}
  );
  const [ytStatus, setYtStatus] = useState<Record<string, YTLiveResult>>({});

  useEffect(() => {
    if (activePlayback && activePlayback.source !== "floating") {
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

  async function loadLiveRows() {
    setLiveLoading(true);
    setLiveError("");

    try {
      const res = await fetch("/api/live-videos", { cache: "no-store" });
      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(json?.error || `Live rows fetch failed (${res.status})`);
      }

      const rawItems: any[] =
        (json?.data?.items ??
          json?.items ??
          json?.data ??
          json?.data?.Items ??
          []) as any[];

      if (!Array.isArray(rawItems)) {
        throw new Error(
          `Live rows response shape unexpected. Got keys: ${Object.keys(
            json || {}
          ).join(", ")}`
        );
      }

      const normalize = (s: any) => String(s ?? "").trim().toLowerCase();
      const isLiveSection = (s: any) => normalize(s) === "live videos";
      const isRevolutionGroup = (g: any) => {
        const x = normalize(g);
        return x.includes("revolution") && x.includes("tv") && x.includes("channel");
      };
      const getUrl = (item: any) => item?.url || item?.URL || item?.link || "";

      const cleaned: LiveRow[] = rawItems
        .map((x: any) => ({ ...x, url: getUrl(x) }))
        .filter((x: any) => !!x.url)
        .filter((x: any) => (x?.active ?? true) === true)
        .filter((x: any) => isLiveSection(x?.section))
        .filter((x: any) => isRevolutionGroup(x?.group))
        .map((x: any) => ({
          PK: String(x.PK ?? ""),
          url: String(x.url ?? ""),
          title: x.title ? String(x.title) : undefined,
          section: x.section ? String(x.section) : undefined,
          group: x.group ? String(x.group) : undefined,
          active: typeof x.active === "boolean" ? x.active : undefined,
        }))
        .filter((x) => !!x.PK && !!x.url);

      setLiveRows(cleaned);
    } catch (e: any) {
      setLiveError(e?.message || "Failed to load LIVE rows");
      setLiveRows([]);
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    loadLiveRows();
  }, []);

  async function pollYouTubeLive(handles: string[]) {
    if (handles.length === 0) return;

    const q = encodeURIComponent(handles.join(","));
    const url = `/api/youtube/live?handles=${q}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "YT live check failed");

      const results: Record<string, YTLiveResult> = json.results || {};
      const now = Date.now();

      Object.entries(results).forEach(([handle, r]) => {
        lastGoodRef.current[handle] = { at: now, data: r };
      });

      setYtStatus(results);
    } catch {
      const now = Date.now();
      const held: Record<string, YTLiveResult> = {};
      for (const h of handles) {
        const heldEntry = lastGoodRef.current[h];
        if (heldEntry && now - heldEntry.at < 90_000) held[h] = heldEntry.data;
        else held[h] = { handle: h, isLive: false, error: "request_failed" };
      }
      setYtStatus(held);
    }
  }

  const ytHandles = useMemo(() => {
    const handles = liveRows
      .map((r) => (isYouTubeUrl(r.url) ? extractHandle(r.url) : null))
      .filter((h): h is string => !!h);
    return Array.from(new Set(handles));
  }, [liveRows]);

  useEffect(() => {
    pollYouTubeLive(ytHandles);
    const t = setInterval(() => pollYouTubeLive(ytHandles), 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytHandles.join(",")]);

  const liveCards = useMemo(() => {
    const cards = liveRows.map((row) => {
      const isYT = isYouTubeUrl(row.url);
      const handle = isYT ? extractHandle(row.url) : null;
      const status = handle ? ytStatus[handle] : undefined;

      const isLive = isYT ? !!status?.isLive && !!status?.videoId : true;
      const videoId = status?.videoId;

      const activeUrl = isYT
        ? videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : "(no live videoId detected)"
        : row.url;

      return {
        PK: row.PK,
        title: row.title || row.PK,
        url: row.url,
        isYouTube: isYT,
        handle,
        isLive,
        videoId,
        statusError: status?.error,
        statusTitle: status?.title,
        activeUrl,
      };
    });

    return cards.sort((a, b) => {
      const aRank = a.isLive ? 0 : 2;
      const bRank = b.isLive ? 0 : 2;
      if (aRank !== bRank) return aRank - bRank;
      return a.title.localeCompare(b.title);
    });
  }, [liveRows, ytStatus]);

  const openMiniWindow = (url: string) => {
    const w = 520;
    const h = 380;
    const left = Math.max(0, window.screenX + window.outerWidth - w - 30);
    const top = Math.max(0, window.screenY + 80);
    window.open(
      url,
      "olgoo_live_mini",
      `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  return (
    <div className="relative min-h-screen text-white">
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
        style={{ backgroundColor: "rgba(22, 28, 36, 0.05)" }}
      />

      <div className="relative z-10">
        <Header />
      </div>

      <div className="relative z-0">
        <main className="container mx-auto px-4 py-8">
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-bold tracking-wide">LIVE</h2>
              <button
                onClick={loadLiveRows}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
              >
                Refresh
              </button>
            </div>

            {liveLoading && <div className="text-white/70">Loading live sources…</div>}

            {liveError && (
              <div className="text-red-200 bg-red-950/30 border border-red-900/40 p-3 rounded-lg">
                {liveError}
              </div>
            )}

            {!liveLoading && !liveError && liveCards.length === 0 && (
              <div className="text-white/70">No Live Videos records found in DynamoDB.</div>
            )}

            <div className="flex gap-4 overflow-x-auto pb-2">
              {liveCards.map((c) => {
                const offline = c.isYouTube && !c.isLive;

                return (
                  <div
                    key={c.PK}
                    className={`shrink-0 rounded-2xl border ${
                      offline
                        ? "bg-black/35 border-white/10 opacity-60"
                        : "bg-black/45 border-white/15"
                    }`}
                    style={{ width: "360px" }}
                  >
                    {/* TOP BAR */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{c.title}</div>

                        {c.isYouTube ? (
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              c.isLive
                                ? "border-red-400/40 bg-red-500/20 text-red-100"
                                : "border-white/15 bg-white/5 text-white/70"
                            }`}
                          >
                            {c.isLive ? "LIVE" : "Offline"}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full border border-amber-400/30 bg-amber-500/15 text-amber-100">
                            External
                          </span>
                        )}
                      </div>

                      {/* DEBUG LINE: show source URL + active URL */}
                      <div className="text-[11px] leading-4 text-white/70 break-words">
                        <div>
                          <span className="text-white/50">Source:</span>{" "}
                          {c.url}
                        </div>

                        {c.isYouTube && (
                          <div>
                            <span className="text-white/50">Handle:</span>{" "}
                            {c.handle || "(none)"}{" "}
                            <span className="text-white/40">|</span>{" "}
                            <span className="text-white/50">Detected:</span>{" "}
                            {c.activeUrl}
                            {c.statusError ? (
                              <>
                                {" "}
                                <span className="text-white/40">|</span>{" "}
                                <span className="text-red-200/80">err:</span>{" "}
                                {c.statusError}
                              </>
                            ) : null}
                          </div>
                        )}

                        {c.isYouTube && c.statusTitle ? (
                          <div>
                            <span className="text-white/50">YT title:</span>{" "}
                            {c.statusTitle}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* PLAYER AREA */}
                    <div className="px-3 pb-3">
                      <div className="rounded-xl overflow-hidden bg-black/40 border border-white/10 h-[200px]">
                        {c.isYouTube ? (
                          c.isLive && c.videoId ? (
                            <YouTubeEmbed videoId={c.videoId} />
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-white/70 text-sm">
                              <div className="font-semibold mb-1">Unavailable</div>
                              <div className="text-xs text-white/50 text-center px-6">
                                {c.statusError === "request_failed"
                                  ? "Temporary check failure (holding last status)."
                                  : "Not live right now, or detection returned no videoId."}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-white/80">
                            <div className="text-sm mb-3 text-center px-6">
                              External source opens in mini window (cannot be embedded).
                            </div>
                            <button
                              onClick={() => openMiniWindow(c.url)}
                              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/20 border border-white/15"
                            >
                              ▶ OPEN LIVE
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Existing content */}
          <VideoHub
            onVideoClick={(video) => {
              handleVideoPlay({
                url: video.url,
                person: video.person || video.personName,
                title: video.title,
                timestamp: video.createdAt,
              });
            }}
          />
          <AudioHub />
          <VideoSubmissionForm />
          <SocialLinksForm />
        </main>

        <BreakingNewsBanner />
        <Footer />
      </div>

      <FloatingVideoPlayer
        isOpen={!!playingVideo}
        onClose={handleClosePlayer}
        videoUrl={playingVideo?.url}
        person={playingVideo?.person}
        title={playingVideo?.title}
        timestamp={playingVideo?.timestamp}
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
