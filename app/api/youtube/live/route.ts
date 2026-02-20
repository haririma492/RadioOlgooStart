// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";

type FoundBy = "live_redirect" | "live_html_signals" | "streams_html_signals" | "none";
type Result = {
  handle: string;
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  foundBy: FoundBy;
  candidatesChecked: number;
  error?: string;
  debug?: any;
};

function normalizeHandle(h: string) {
  return (h || "").trim().replace(/^@/, "");
}

function extractHandleFromUrlOrHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);
  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return normalizeHandle(m[1]);
  return null;
}

function isValidVideoId(v: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(v);
}

function extractVideoIdFromUrl(u: string): string | null {
  try {
    const url = new URL(u);
    const v = url.searchParams.get("v");
    if (v && isValidVideoId(v)) return v;
    if (/youtu\.be$/i.test(url.hostname)) {
      const id = url.pathname.replace("/", "");
      if (isValidVideoId(id)) return id;
    }
    // Also catch rare /live/VIDEO_ID format
    const livePathMatch = url.pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})/);
    if (livePathMatch?.[1]) return livePathMatch[1];
    return null;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, finalUrl: res.url || url, text };
}

function hasStrongLiveSignals(html: string): boolean {
  const lower = html.toLowerCase();
  // Strong positive signals (present → likely live)
  if (
    lower.includes("watching now") ||
    lower.includes('"watching"') ||
    lower.includes("livechat") ||
    lower.includes("live-chat") ||
    lower.includes('"isLive":true') ||
    lower.match(/"[0-9,]+ watching"/) ||
    lower.includes('"status":"LIVE"')
  ) {
    return true;
  }
  // Negative signals that usually mean NOT live (past VOD/premiere)
  if (
    lower.includes("streamed") ||
    lower.includes("ended") ||
    lower.includes("premiered") ||
    lower.includes("premiere") ||
    lower.includes("upcoming")
  ) {
    return false;
  }
  // Neutral / weak → don't count as live
  return false;
}

function extractVideoIdFromHtml(html: string): string | null {
  // Look for common places where video ID appears in live embed config
  const patterns = [
    /"videoId":"([a-zA-Z0-9_-]{11})"/,
    /"video_id":"([a-zA-Z0-9_-]{11})"/,
    /\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function checkCandidate(url: string, candidateName: "live" | "streams"): Promise<Partial<Result>> {
  const res = await fetchHtml(url);
  const debugEntry = {
    url,
    status: res.status,
    finalUrl: res.finalUrl,
    finalPath: new URL(res.finalUrl).pathname,
  };

  const redirectedVideoId = extractVideoIdFromUrl(res.finalUrl);
  if (redirectedVideoId) {
    return {
      isLive: true,
      videoId: redirectedVideoId,
      watchUrl: `https://www.youtube.com/watch?v=${redirectedVideoId}`,
      foundBy: "live_redirect" as FoundBy,
      debug: { ...debugEntry, redirected: true },
    };
  }

  // No redirect → check HTML signals
  const hasLive = hasStrongLiveSignals(res.text);
  const htmlVideoId = extractVideoIdFromHtml(res.text) || extractVideoIdFromUrl(res.finalUrl);

  if (hasLive && htmlVideoId) {
    return {
      isLive: true,
      videoId: htmlVideoId,
      watchUrl: `https://www.youtube.com/watch?v=${htmlVideoId}`,
      foundBy: candidateName === "live" ? "live_html_signals" : "streams_html_signals",
      debug: { ...debugEntry, htmlSignals: true, extractedVideoId: htmlVideoId },
    };
  }

  return {
    isLive: false,
    foundBy: "none" as FoundBy,
    debug: {
      ...debugEntry,
      htmlHasWatchingNow: res.text.toLowerCase().includes("watching now"),
      htmlHasLiveChat: res.text.toLowerCase().includes("livechat"),
      htmlHasEnded: res.text.toLowerCase().includes("ended") || res.text.toLowerCase().includes("streamed"),
    },
  };
}

async function resolveLive(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h };
  let candidatesChecked = 0;

  // Primary: /live
  const liveUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/live?hl=en&persist_app=1&app=desktop`;
  const liveResult = await checkCandidate(liveUrl, "live");
  candidatesChecked++;
  debug.live = liveResult.debug;

  if (liveResult.isLive) {
    return {
      handle: h,
      isLive: true,
      videoId: liveResult.videoId,
      watchUrl: liveResult.watchUrl,
      foundBy: liveResult.foundBy!,
      candidatesChecked,
      debug,
    };
  }

  // Secondary: /streams (fallback)
  const streamsUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/streams?hl=en&persist_app=1&app=desktop`;
  const streamsResult = await checkCandidate(streamsUrl, "streams");
  candidatesChecked++;
  debug.streams = streamsResult.debug;

  if (streamsResult.isLive) {
    return {
      handle: h,
      isLive: true,
      videoId: streamsResult.videoId,
      watchUrl: streamsResult.watchUrl,
      foundBy: streamsResult.foundBy!,
      candidatesChecked,
      debug,
    };
  }

  // Neither worked
  return {
    handle: h,
    isLive: false,
    foundBy: "none",
    candidatesChecked,
    debug,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";
  const rawList = (handlesParam ? handlesParam.split(",") : []).concat(
    inputsParam ? inputsParam.split(",") : []
  );
  const handles = rawList
    .map((x) => extractHandleFromUrlOrHandle(x))
    .filter((x): x is string => !!x);
  const unique = Array.from(new Set(handles));
  const results: Record<string, Result> = {};

  for (const h of unique) {
    try {
      const r = await resolveLive(h);
      results[r.handle] = r;
    } catch (e: any) {
      const hh = normalizeHandle(h);
      results[hh] = {
        handle: hh,
        isLive: false,
        foundBy: "none",
        candidatesChecked: 0,
        error: e?.message || "unknown_error",
      };
    }
  }

  return NextResponse.json(
    { ok: true, results },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}