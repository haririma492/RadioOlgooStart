"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveSection from "@/components/LiveSection/LiveSection";
import type { LiveItem } from "@/lib/youtubeLive";
import { youtubeWatchUrl } from "@/lib/youtubeLive";

type LiveRow = {
  PK: string;
  url: string;
  channelId?: string;
  title?: string;
  section?: string;
  group?: string;
  active?: boolean;
};

type YTLiveResult = {
  handle: string;
  isLive: boolean;
  videoId?: string;
  embedUrl?: string;
  watchUrl?: string;
  title?: string;
  error?: string;
};

function normalizeStr(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function extractHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return s.replace(/^@/, "");
  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return m[1];
  return null;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url || "");
}

function extractVideoIdFromYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    if (/youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.replace("/", "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    return null;
  } catch {
    return null;
  }
}

export default function LiveBlock() {
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string>("");

  const lastGoodRef = useRef<Record<string, { at: number; data: YTLiveResult }>>({});
  const [ytStatus, setYtStatus] = useState<Record<string, YTLiveResult>>({});
  const [ytLiveLoading, setYtLiveLoading] = useState(false);

  async function loadLiveRows() {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch("/api/live-videos", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `Live rows fetch failed (${res.status})`);
      }

      let items: unknown[] | undefined;
      if (Array.isArray(json?.items)) items = json.items;
      else if (Array.isArray(json?.data?.items)) items = json.data.items;
      else if (Array.isArray(json?.data)) items = json.data;
      else if (Array.isArray(json?.data?.Items)) items = json.data.Items;

      if (!Array.isArray(items)) {
        throw new Error(
          `Live rows response shape unexpected. Keys: ${Object.keys(json || {}).join(", ")}`
        );
      }

      const isLiveSection = (s: unknown) => normalizeStr(s) === "live videos";
      const isRevolutionGroup = (g: unknown) => {
        const x = normalizeStr(g);
        return x.includes("revolution") && x.includes("tv") && x.includes("channel");
      };
      const getUrl = (it: { url?: string; URL?: string; link?: string }) =>
        it?.url || it?.URL || it?.link || "";

      const cleaned: LiveRow[] = items
        .map((x: { url?: string; URL?: string; link?: string; channelId?: string; active?: boolean;[k: string]: unknown }) => ({ ...x, url: getUrl(x) }))
        .filter((x): x is LiveRow & { url: string } => !!x?.url)
        .filter((x) => (x?.active ?? true) === true)
        .filter((x) => isLiveSection(x?.section))
        .filter((x) => isRevolutionGroup(x?.group));

      setLiveRows(cleaned);
    } catch (e: unknown) {
      setLiveError(e instanceof Error ? e.message : "Failed to load LIVE rows");
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    loadLiveRows();
  }, []);

  async function pollYouTubeLive(rows: LiveRow[]) {
    const ytRows = rows.filter((r) => isYouTubeUrl(r.url) && !extractVideoIdFromYouTubeUrl(r.url));
    if (ytRows.length === 0) {
      setYtLiveLoading(false);
      return;
    }

    // Prefer channelId param (RSS path, zero quota) — fallback to handle
    const withChannelId = ytRows.filter((r) => r.channelId);
    const withoutChannelId = ytRows.filter((r) => !r.channelId);

    const params = new URLSearchParams();
    if (withChannelId.length > 0) {
      // format: UCxxx:handle,UCyyy:handle2
      params.set(
        "channelIds",
        withChannelId
          .map((r) => `${r.channelId}${r.url ? ":" + (extractHandle(r.url) || "") : ""}`)
          .join(",")
      );
    }
    if (withoutChannelId.length > 0) {
      const handles = withoutChannelId
        .map((r) => extractHandle(r.url))
        .filter((h): h is string => !!h);
      if (handles.length > 0) params.set("handles", handles.join(","));
    }

    const url = `/api/youtube/live?${params.toString()}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "YT live check failed");

      const results: Record<string, YTLiveResult> = json.results || {};
      const now = Date.now();

      Object.entries(results).forEach(([key, r]) => {
        lastGoodRef.current[key] = { at: now, data: r };
      });

      setYtStatus(results);
    } catch {
      const now = Date.now();
      const held: Record<string, YTLiveResult> = {};
      for (const row of ytRows) {
        const key = extractHandle(row.url) || row.channelId || row.url;
        const heldEntry = lastGoodRef.current[key];
        if (heldEntry && now - heldEntry.at < 10 * 60_000) {
          held[key] = heldEntry.data;
        } else {
          held[key] = { handle: key, isLive: false, error: "request_failed" };
        }
      }
      setYtStatus(held);
    } finally {
      setYtLiveLoading(false);
    }
  }

  const ytRows = useMemo(() => {
    return liveRows.filter(
      (r) => isYouTubeUrl(r.url) && !extractVideoIdFromYouTubeUrl(r.url)
    );
  }, [liveRows]);

  // Legacy handle list (for dep array / backward compat)
  const ytHandles = useMemo(() => {
    return ytRows
      .map((r) => r.channelId || extractHandle(r.url))
      .filter((h): h is string => !!h);
  }, [ytRows]);

  useEffect(() => {
    if (ytRows.length === 0) {
      setYtLiveLoading(false);
      return;
    }
    setYtLiveLoading(true);
    pollYouTubeLive(ytRows);

    // Poll every 10 minutes to stay within ~3000 quota/day (RSS + batch videos.list only)
    const t = setInterval(() => pollYouTubeLive(ytRows), 10 * 60_000);
    return () => clearInterval(t);
  }, [ytHandles.join(",")]);

  const liveCards = useMemo(() => {
    const cards = liveRows.map((row) => {
      const isYT = isYouTubeUrl(row.url);
      const directVideoId = isYT ? extractVideoIdFromYouTubeUrl(row.url) : null;
      const handle = isYT && !directVideoId ? extractHandle(row.url) : null;
      // Match API key: API uses entry.handle || entry.channelId, so look up by handle first
      const statusKey = handle || row.channelId;
      const status = statusKey ? ytStatus[statusKey] : undefined;
      const videoId = directVideoId || status?.videoId;
      const embedUrl = status?.embedUrl;
      // Consider live if we have videoId OR channel embedUrl (API may return embedUrl only on Vercel when discovery fails)
      const isLive = isYT && (!!videoId || !!embedUrl);

      return {
        PK: row.PK,
        title: row.title || row.PK,
        url: row.url,
        isYouTube: isYT,
        handle,
        channelId: row.channelId,
        isLive,
        videoId,
        embedUrl,
        watchUrl: status?.watchUrl,
        statusError: status?.error,
      };
    });

    const onlyLive = cards.filter((c) => c.isLive);
    return onlyLive.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [liveRows, ytStatus]);

  const liveYouTubeItems: LiveItem[] = useMemo(() => {
    return liveCards
      .filter((c) => c.isYouTube && (c.videoId || c.embedUrl))
      .map((c) => ({
        handle: (c.handle || c.title || c.PK).toString(),
        videoId: c.videoId || `channel-${c.channelId || c.PK}`,
        watchUrl: c.watchUrl || (c.videoId ? youtubeWatchUrl(c.videoId) : c.url),
        embedUrl: c.embedUrl,
      }));
  }, [liveCards]);

  return (
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

      {!liveLoading && !liveError && ytLiveLoading && ytHandles.length > 0 && (
        <div className="text-white/70">Loading live channels…</div>
      )}

      {!liveLoading && !liveError && !ytLiveLoading && liveCards.length === 0 && (
        <div className="text-white/70">No sources are live right now.</div>
      )}

      {!liveLoading && !liveError && !ytLiveLoading && liveYouTubeItems.length > 0 && (
        <div className="mb-6">
          <LiveSection liveItems={liveYouTubeItems} maxWall={5} title="LIVE" />
        </div>
      )}
    </section>
  );
}
