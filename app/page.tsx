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
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";

import LiveSection from "@/components/LiveSection/LiveSection";
import type { LiveItem } from "@/lib/youtubeLive";
import { youtubeWatchUrl } from "@/lib/youtubeLive";

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

type ExternalStatusResult = {
  id: string;
  state: "LIVE" | "OFFLINE" | "UNKNOWN";
  error?: string;
};

function normalizeStr(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function extractHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  // handle string
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return s.replace(/^@/, "");

  // URL: youtube.com/@Handle
  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return m[1];

  return null;
}

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url || "");
}

function extractVideoIdFromYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url);

    // youtube.com/watch?v=XXXX
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtu.be/XXXX
    if (/youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.replace("/", "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
}

function HomePageContent() {
  const [playingVideo, setPlayingVideo] = useState<PlayingVideo | null>(null);
  const { activePlayback, setActivePlayback } = usePlayback();

  // LIVE rows
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string>("");

  // YouTube status (hold last good)
  const lastGoodRef = useRef<Record<string, { at: number; data: YTLiveResult }>>(
    {}
  );
  const [ytStatus, setYtStatus] = useState<Record<string, YTLiveResult>>({});

  // External status (optional — used for hiding non-live externals)
  const [externalStatus, setExternalStatus] = useState<Record<string, ExternalStatusResult>>(
    {}
  );

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

  // ---- Load LIVE rows from DynamoDB via backend route
  async function loadLiveRows() {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch("/api/live-videos", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `Live rows fetch failed (${res.status})`);
      }

      // Accept shapes:
      // { ok:true, data:{ items:[...] } }
      // { items:[...] }
      // { data:[...] }
      // { data:{ Items:[...] } }
      let items: any[] | undefined;

      if (Array.isArray(json?.items)) items = json.items;
      else if (Array.isArray(json?.data?.items)) items = json.data.items;
      else if (Array.isArray(json?.data)) items = json.data;
      else if (Array.isArray(json?.data?.Items)) items = json.data.Items;

      if (!Array.isArray(items)) {
        throw new Error(
          `Live rows response shape unexpected. Keys: ${Object.keys(json || {}).join(
            ", "
          )}`
        );
      }

      const isLiveSection = (s: any) => normalizeStr(s) === "live videos";

      // Accept "Revolution TV/Channels" and variants
      const isRevolutionGroup = (g: any) => {
        const x = normalizeStr(g);
        return x.includes("revolution") && x.includes("tv") && x.includes("channel");
      };

      const getUrl = (it: any) => it?.url || it?.URL || it?.link || "";

      const cleaned: LiveRow[] = items
        .map((x: any) => ({ ...x, url: getUrl(x) }))
        .filter((x: any) => !!x?.url)
        .filter((x: any) => (x?.active ?? true) === true)
        .filter((x: any) => isLiveSection(x?.section))
        .filter((x: any) => isRevolutionGroup(x?.group));

      setLiveRows(cleaned);
    } catch (e: any) {
      setLiveError(e?.message || "Failed to load LIVE rows");
    } finally {
      setLiveLoading(false);
    }
  }

  // Load once on mount
  useEffect(() => {
    loadLiveRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Poll YouTube live status
  async function pollYouTubeLive(handles: string[]) {
    if (handles.length === 0) return;

    const q = encodeURIComponent(handles.join(","));
    const url = `/api/youtube/live?handles=${q}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "YT live check failed");

      const results: Record<string, YTLiveResult> = json.results || {};
      const now = Date.now();

      Object.entries(results).forEach(([handle, r]) => {
        lastGoodRef.current[handle] = { at: now, data: r };
      });

      setYtStatus(results);
    } catch {
      // Hold last known for 10 minutes (since we poll less frequently now)
      const now = Date.now();
      const held: Record<string, YTLiveResult> = {};
      for (const h of handles) {
        const heldEntry = lastGoodRef.current[h];
        if (heldEntry && now - heldEntry.at < 10 * 60_000) {
          held[h] = heldEntry.data;
        } else {
          held[h] = { handle: h, isLive: false, error: "request_failed" };
        }
      }
      setYtStatus(held);
    }
  }

  const ytHandles = useMemo(() => {
    // Only for channel/handle URLs (watch?v does not need detection)
    const handles = liveRows
      .map((r) => {
        if (!isYouTubeUrl(r.url)) return null;
        const direct = extractVideoIdFromYouTubeUrl(r.url);
        if (direct) return null; // direct watch link => no need to poll
        return extractHandle(r.url);
      })
      .filter((h): h is string => !!h);

    return Array.from(new Set(handles));
  }, [liveRows]);

  useEffect(() => {
    pollYouTubeLive(ytHandles);

    // IMPORTANT: was 20s; now we poll every 5 minutes (you dropped 30-sec idea).
    const t = setInterval(() => pollYouTubeLive(ytHandles), 5 * 60_000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytHandles.join(",")]);

  // ---- External status checker (optional): hide non-live externals
  async function pollExternalStatus(rows: LiveRow[]) {
    const externals = rows.filter((r) => r.url && !isYouTubeUrl(r.url));
    if (externals.length === 0) return;

    try {
      // expects your backend route: POST /api/external/status
      // body: { items: [{ id, url }] }
      const payload = {
        items: externals.map((r) => ({ id: r.PK, url: r.url })),
      };

      const res = await fetch("/api/external/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "external status failed");

      const arr: ExternalStatusResult[] = json?.results || json?.data || [];
      if (Array.isArray(arr)) {
        const map: Record<string, ExternalStatusResult> = {};
        for (const r of arr) map[r.id] = r;
        setExternalStatus(map);
      }
    } catch {
      // If external check fails, keep previous status (don’t blank UI)
    }
  }

  useEffect(() => {
    pollExternalStatus(liveRows);

    // external can stay fairly frequent; it’s your backend, not YT quota
    const t = setInterval(() => pollExternalStatus(liveRows), 60_000);

    return () => clearInterval(t);
  }, [liveRows]);

  // ---- Build LIVE cards and HIDE non-live (your requirement)
  const liveCards = useMemo(() => {
    const cards = liveRows.map((row) => {
      const isYT = isYouTubeUrl(row.url);

      // YouTube: support direct watch links OR detected live
      const directVideoId = isYT ? extractVideoIdFromYouTubeUrl(row.url) : null;
      const handle = isYT && !directVideoId ? extractHandle(row.url) : null;
      const status = handle ? ytStatus[handle] : undefined;

      const videoId = directVideoId || status?.videoId;

      // External: use externalStatus if available; otherwise treat as UNKNOWN (hide)
      const ext = !isYT ? externalStatus[row.PK] : undefined;
      const externalIsLive = !isYT ? ext?.state === "LIVE" : false;

      const isLive = isYT ? !!videoId : externalIsLive;

      return {
        PK: row.PK,
        title: row.title || row.PK,
        url: row.url,
        isYouTube: isYT,
        handle,
        isLive,
        videoId,
        statusError: status?.error,
        externalState: ext?.state,
        externalError: ext?.error,
      };
    });

    // ✅ ONLY show live items
    const onlyLive = cards.filter((c) => c.isLive);

    return onlyLive.sort((a, b) => a.title.localeCompare(b.title));
  }, [liveRows, ytStatus, externalStatus]);

  // ---- Build LiveSection items (YouTube only)
  const liveYouTubeItems: LiveItem[] = useMemo(() => {
    return liveCards
      .filter((c) => c.isYouTube && !!c.videoId)
      .map((c) => ({
        // handle is best label; fall back to title
        handle: (c.handle || c.title || c.PK).toString(),
        videoId: c.videoId!,
        watchUrl: youtubeWatchUrl(c.videoId!),
      }));
  }, [liveCards]);

  // ---- External live cards (still shown, but they don’t “stream” inline)
  const liveExternalCards = useMemo(() => {
    return liveCards.filter((c) => !c.isYouTube);
  }, [liveCards]);

  // external mini window opener
  const openMiniWindow = (url: string) => {
    const w = 520;
    const h = 360; // smaller height
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
      {/* Background Image */}
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
          {/* LIVE SECTION */}
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
              <div className="text-white/70">No sources are live right now.</div>
            )}

            {/* ✅ YouTube LIVE wall/focus logic (max 5 wall streams) */}
            {!liveLoading && !liveError && liveYouTubeItems.length > 0 && (
              <div className="mb-6">
                <LiveSection liveItems={liveYouTubeItems} maxWall={5} title="LIVE" />
              </div>
            )}

            {/* External LIVE sources (not embedded) */}
            {!liveLoading && !liveError && liveExternalCards.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold opacity-90">External LIVE</div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {liveExternalCards.map((c) => (
                    <div
                      key={c.PK}
                      className="shrink-0 rounded-2xl border bg-black/45 border-white/15"
                      style={{ width: "340px" }}
                    >
                      <div className="p-3 flex items-center justify-between">
                        <div className="font-semibold truncate pr-2">{c.title}</div>

                        <span className="text-xs px-2 py-1 rounded-full border border-red-400/40 bg-red-500/20 text-red-100">
                          LIVE
                        </span>
                      </div>

                      <div className="px-3 pb-2 text-[11px] text-white/60 break-all">{c.url}</div>

                      <div className="px-3 pb-3">
                        <div className="rounded-xl overflow-hidden bg-black/40 border border-white/10 h-[190px]">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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