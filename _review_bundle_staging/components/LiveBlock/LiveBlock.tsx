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

function toPersianDigits(value: number): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export default function LiveBlock() {
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string>("");

  const lastGoodRef = useRef<Record<string, { at: number; data: YTLiveResult }>>({});
  const [ytStatus, setYtStatus] = useState<Record<string, YTLiveResult>>({});
  const [ytLiveLoading, setYtLiveLoading] = useState(false);
  const [isFa, setIsFa] = useState(true);

  useEffect(() => {
    const root = document.getElementById("user-page");
    const dir = root?.getAttribute("dir");
    setIsFa(dir === "rtl");
  }, []);

  async function loadLiveRows() {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch(`/api/live-videos?t=${Date.now()}`, { cache: "no-store" });
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
        .map(
          (x: {
            url?: string;
            URL?: string;
            link?: string;
            channelId?: string;
            active?: boolean;
            [k: string]: unknown;
          }) => ({ ...x, url: getUrl(x) })
        )
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
    const ytRows = rows.filter(
      (r) => isYouTubeUrl(r.url) && !extractVideoIdFromYouTubeUrl(r.url)
    );
    if (ytRows.length === 0) {
      setYtLiveLoading(false);
      return;
    }

    const withChannelId = ytRows.filter((r) => r.channelId);
    const withoutChannelId = ytRows.filter((r) => !r.channelId);

    const params = new URLSearchParams();
    if (withChannelId.length > 0) {
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

    const url = `/api/youtube/live?${params.toString()}&t=${Date.now()}`;

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
        if (heldEntry && now - heldEntry.at < 2 * 60_000) {
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

    const t = setInterval(() => pollYouTubeLive(ytRows), 7 * 60_000);
    return () => clearInterval(t);
  }, [ytHandles.join(",")]);

  const liveCards = useMemo(() => {
    const cards = liveRows.map((row) => {
      const isYT = isYouTubeUrl(row.url);
      const directVideoId = isYT ? extractVideoIdFromYouTubeUrl(row.url) : null;
      const handle = isYT && !directVideoId ? extractHandle(row.url) : null;
      const statusKey = handle || row.channelId;
      const status = statusKey ? ytStatus[statusKey] : undefined;
      const videoId = directVideoId || status?.videoId;
      const embedUrl = status?.embedUrl;
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

  const liveCount = liveYouTubeItems.length;
  const headerLabel = isFa ? "" : "";
  const countText = isFa
  const loadingSourcesText = isFa ? "در حال بارگذاری منابع زنده..." : "Loading live sources...";
  const loadingChannelsText = isFa ? "در حال بارگذاری کانال‌های زنده..." : "Loading live channels...";
  const noneLiveText = isFa ? "اکنون کانال زنده‌ای وجود ندارد." : "No channels are live right now.";
  const refreshText = isFa ? "بازخوانی" : "Refresh";

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
          <span className={isFa ? "text-2xl font-bold tracking-normal" : "text-3xl font-bold tracking-wide"}>
            {headerLabel}
          </span>
        </div>

        <button
          onClick={loadLiveRows}
          className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 hover:bg-white/15"
        >
          {refreshText}
        </button>
      </div>

      {liveLoading && <div className="text-white/70">{loadingSourcesText}</div>}

      {liveError && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-red-200">
          {liveError}
        </div>
      )}

      {!liveLoading && !liveError && ytLiveLoading && ytHandles.length > 0 && (
        <div className="text-white/70">{loadingChannelsText}</div>
      )}

      {!liveLoading && !liveError && !ytLiveLoading && liveCards.length === 0 && (
        <div className="text-white/70">{noneLiveText}</div>
      )}

      {!liveLoading && !liveError && !ytLiveLoading && liveYouTubeItems.length > 0 && (
        <div className="mb-6">
          <LiveSection liveItems={liveYouTubeItems} maxWall={5} title="" />
        </div>
      )}
    </section>
  );
}