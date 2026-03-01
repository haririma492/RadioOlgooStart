"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveSection from "@/components/LiveSection/LiveSection";
import type { LiveItem } from "@/lib/youtubeLive";
import { youtubeWatchUrl } from "@/lib/youtubeLive";

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

function openMiniWindow(url: string): void {
  const w = 520;
  const h = 360;
  const left = Math.max(0, window.screenX + window.outerWidth - w - 30);
  const top = Math.max(0, window.screenY + 80);
  window.open(
    url,
    "olgoo_live_mini",
    `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

export default function LiveBlock() {
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string>("");

  const lastGoodRef = useRef<Record<string, { at: number; data: YTLiveResult }>>({});
  const [ytStatus, setYtStatus] = useState<Record<string, YTLiveResult>>({});
  const [ytLiveLoading, setYtLiveLoading] = useState(false);

  const [externalStatus, setExternalStatus] = useState<Record<string, ExternalStatusResult>>({});

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
        .map((x: { url?: string; URL?: string; link?: string; active?: boolean; [k: string]: unknown }) => ({ ...x, url: getUrl(x) }))
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
    } finally {
      setYtLiveLoading(false);
    }
  }

  const ytHandles = useMemo(() => {
    const handles = liveRows
      .map((r) => {
        if (!isYouTubeUrl(r.url)) return null;
        const direct = extractVideoIdFromYouTubeUrl(r.url);
        if (direct) return null;
        return extractHandle(r.url);
      })
      .filter((h): h is string => !!h);

    return Array.from(new Set(handles));
  }, [liveRows]);

  useEffect(() => {
    if (ytHandles.length === 0) {
      setYtLiveLoading(false);
      return;
    }
    setYtLiveLoading(true);
    pollYouTubeLive(ytHandles);

    const t = setInterval(() => pollYouTubeLive(ytHandles), 5 * 60_000);
    return () => clearInterval(t);
  }, [ytHandles.join(",")]);

  async function pollExternalStatus(rows: LiveRow[]) {
    const externals = rows.filter((r) => r.url && !isYouTubeUrl(r.url));
    if (externals.length === 0) return;

    try {
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
      // keep previous status on failure
    }
  }

  useEffect(() => {
    pollExternalStatus(liveRows);
    const t = setInterval(() => pollExternalStatus(liveRows), 60_000);
    return () => clearInterval(t);
  }, [liveRows]);

  const liveCards = useMemo(() => {
    const cards = liveRows.map((row) => {
      const isYT = isYouTubeUrl(row.url);
      const directVideoId = isYT ? extractVideoIdFromYouTubeUrl(row.url) : null;
      const handle = isYT && !directVideoId ? extractHandle(row.url) : null;
      const status = handle ? ytStatus[handle] : undefined;
      const videoId = directVideoId || status?.videoId;

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

    const onlyLive = cards.filter((c) => c.isLive);
    return onlyLive.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [liveRows, ytStatus, externalStatus]);

  const liveYouTubeItems: LiveItem[] = useMemo(() => {
    return liveCards
      .filter((c) => c.isYouTube && !!c.videoId)
      .map((c) => ({
        handle: (c.handle || c.title || c.PK).toString(),
        videoId: c.videoId!,
        watchUrl: youtubeWatchUrl(c.videoId!),
      }));
  }, [liveCards]);

  const liveExternalCards = useMemo(() => {
    return liveCards.filter((c) => !c.isYouTube);
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
  );
}
