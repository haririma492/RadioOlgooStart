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

/**
 * Extract ytInitialPlayerResponse JSON object from YouTube HTML.
 * This is far more reliable than regexing random "videoId" occurrences.
 */
function extractPlayerResponse(html: string): any | null {
  if (!html) return null;

  // Pattern A: ytInitialPlayerResponse = {...};
  let m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m && m[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {
      // ignore
    }
  }

  // Pattern B: "ytInitialPlayerResponse":{...}
  m = html.match(/"ytInitialPlayerResponse"\s*:\s*(\{[\s\S]*?\})\s*,\s*"ytInitialData"/);
  if (m && m[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {
      // ignore
    }
  }

  return null;
}
/**
 * Decide if the page is LIVE *now* using structured player response.
 * We try to be strict to avoid false positives.
 */
function isLiveNowFromPlayerResponse(pr: any): { isLive: boolean; videoId?: string; reason?: string } {
  if (!pr) return { isLive: false, reason: "no_player_response" };

  const videoId = pr.videoDetails?.videoId;
  if (!videoId || !isValidVideoId(videoId)) return { isLive: false, reason: "no_valid_videoId" };

  const isLiveContent = pr.videoDetails?.isLiveContent === true;

  // Most reliable: explicit isLiveNow true
  const isLiveNow =
    pr.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true;

  // Additional hint: liveStreamingDetails exists for live content, but can also exist for scheduled streams.
  const hasLiveStreamingDetails = !!pr.liveStreamingDetails;

  // Strict rule:
  // - must have videoId
  // - AND (isLiveNow true OR (isLiveContent true AND hasLiveStreamingDetails))
  const isLive =
    isLiveNow || (isLiveContent && hasLiveStreamingDetails);

  return { isLive, videoId: isLive ? videoId : undefined, reason: isLive ? "live" : "not_live" };
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

  // If YouTube served consent/interstitial, do NOT parse anything.
  if (looksLikeConsentOrInterstitial(page.finalUrl, page.text)) {
    return {
      isLive: false,
      foundBy: "none",
      debug: { ...debugEntry, blockedOrConsent: true },
    };
  }

  // 1) Redirect-based live ID (safe)
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

  // 2) Structured player response (safe)
  const pr = extractPlayerResponse(page.text);
  const live = isLiveNowFromPlayerResponse(pr);

  if (live.isLive && live.videoId) {
    return {
      isLive: true,
      videoId: live.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${live.videoId}`,
      foundBy: candidateName === "live" ? "live_html_signals" : "streams_html_signals",
      debug: { ...debugEntry, playerResponseLive: true, extractedVideoId: live.videoId, liveReason: live.reason },
    };
  }

  return {
    isLive: false,
    foundBy: "none",
    debug: { ...debugEntry, playerResponseLive: false, liveReason: live.reason },
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