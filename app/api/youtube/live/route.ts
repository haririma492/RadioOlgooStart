// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type CandidateName = "live" | "streams";

type CandidateCheck = {
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  foundBy?: FoundBy;
  debug?: any;
};

function normalizeHandle(h: string) {
  return (h || "").trim().replace(/^@/, "");
}

function extractHandleFromUrlOrHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  // plain handle (with or without @)
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);

  // youtube.com/@handle
  const m1 = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m1?.[1]) return normalizeHandle(m1[1]);

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

    // Rare /live/VIDEO_ID
    const livePathMatch = url.pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})/);
    if (livePathMatch?.[1]) return livePathMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "follow",
    headers: {
      // keep existing headers if caller provided them
      ...(init.headers || {}),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const finalUrl = res.url || url;
  const text = await res.text().catch(() => "");

  return {
    ok: res.ok,
    status: res.status,
    finalUrl,
    text,
  };
}

function hasStrongLiveSignals(html: string): boolean {
  const lower = (html || "").toLowerCase();

  // If YouTube served a consent/interstitial/bot-like page, don't trust any "videoId" we find.
  if (
    lower.includes("consent.youtube.com") ||
    lower.includes("before you continue") ||
    lower.includes("our systems have detected unusual traffic") ||
    lower.includes("sorry for the interruption")
  ) {
    return false;
  }

  // Strong positive signals
  if (
    lower.includes("watching now") ||
    lower.includes('"watching"') ||
    lower.includes("livechat") ||
    lower.includes("live-chat") ||
    lower.includes('"islive":true') ||
    lower.match(/"[0-9,]+ watching"/) ||
    lower.includes('"status":"live"') ||
    lower.includes('"is_live":true')
  ) {
    return true;
  }

  // Strong negative signals
  if (
    lower.includes("streamed") ||
    lower.includes("ended") ||
    lower.includes("premiered") ||
    lower.includes("premiere") ||
    lower.includes("upcoming") ||
    lower.includes('"status":"upcoming"')
  ) {
    return false;
  }

  return false;
}

function extractVideoIdFromHtml(html: string): string | null {
  const patterns = [
    /"videoId":"([a-zA-Z0-9_-]{11})"/,
    /"video_id":"([a-zA-Z0-9_-]{11})"/,
    /\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const regex of patterns) {
    const match = (html || "").match(regex);
    if (match?.[1] && isValidVideoId(match[1])) return match[1];
  }
  return null;
}

function looksLikeConsentOrInterstitial(finalUrl: string, html: string): boolean {
  const u = (finalUrl || "").toLowerCase();
  const h = (html || "").toLowerCase();

  return (
    u.includes("consent.youtube.com") ||
    h.includes("before you continue") ||
    h.includes("our systems have detected unusual traffic") ||
    h.includes("sorry for the interruption")
  );
}

async function checkCandidate(url: string, candidateName: CandidateName): Promise<CandidateCheck> {
  const page = await fetchHtml(url);

  const debugEntry: any = {
    url,
    status: page.status,
    finalUrl: page.finalUrl,
    finalPath: (() => {
      try {
        return new URL(page.finalUrl).pathname;
      } catch {
        return "";
      }
    })(),
    htmlLen: page.text?.length || 0,
  };

  // If YouTube served consent/interstitial, do NOT parse video IDs (they can be random/trending).
  if (looksLikeConsentOrInterstitial(page.finalUrl, page.text)) {
    return {
      isLive: false,
      foundBy: "none",
      debug: { ...debugEntry, blockedOrConsent: true },
    };
  }

  // 1) Redirect-based live ID (often the most reliable)
  const redirectedVideoId = extractVideoIdFromUrl(page.finalUrl);
  if (redirectedVideoId) {
    return {
      isLive: true,
      videoId: redirectedVideoId,
      watchUrl: `https://www.youtube.com/watch?v=${redirectedVideoId}`,
      foundBy: "live_redirect",
      debug: { ...debugEntry, redirected: true },
    };
  }

  // 2) HTML signal-based detection + extraction
  const hasLive = hasStrongLiveSignals(page.text);
  const htmlVideoId = extractVideoIdFromHtml(page.text) || extractVideoIdFromUrl(page.finalUrl);

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
    foundBy: "none",
    debug: { ...debugEntry, hasLiveSignals: hasLive, extractedVideoId: htmlVideoId || null },
  };
}

async function resolveLive(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h };
  let candidatesChecked = 0;

  // Primary: /live
  const liveUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/live?hl=en&gl=US&persist_app=1&app=desktop`;
  const liveResult = await checkCandidate(liveUrl, "live");
  candidatesChecked++;
  debug.live = liveResult.debug;

  if (liveResult.isLive) {
    return {
      handle: h,
      isLive: true,
      videoId: liveResult.videoId,
      watchUrl: liveResult.watchUrl,
      foundBy: liveResult.foundBy || "none",
      candidatesChecked,
      debug,
    };
  }

  // Secondary: /streams
  const streamsUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/streams?hl=en&gl=US&persist_app=1&app=desktop`;
  const streamsResult = await checkCandidate(streamsUrl, "streams");
  candidatesChecked++;
  debug.streams = streamsResult.debug;

  if (streamsResult.isLive) {
    return {
      handle: h,
      isLive: true,
      videoId: streamsResult.videoId,
      watchUrl: streamsResult.watchUrl,
      foundBy: streamsResult.foundBy || "none",
      candidatesChecked,
      debug,
    };
  }

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