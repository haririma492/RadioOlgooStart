// app/api/youtube/live/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const preferredRegion = 'fra1';   // Frankfurt

/**
 * STRICT LIVE DETECTION (NO GUESSING):
 * - We NEVER use YouTube Data API => 0 quota usage.
 * - We ONLY mark a channel as live if:
 *   A) /@handle/live redirects to watch?v=...
 *   OR
 *   B) ytInitialPlayerResponse says isLiveNow === true AND has a valid videoId
 * - Otherwise isLive=false.
 *
 * Optional: verify the found videoId by fetching the watch page and re-checking isLiveNow.
 */

console.log("[yt-live] hasKey=", !!process.env.YOUTUBE_API_KEY, "len=", (process.env.YOUTUBE_API_KEY || "").length);
const CDN_TTL_SECONDS = 60;
const STALE_SECONDS = 240;

const MEM_TTL_MS = 90 * 1000;
const memCache = new Map<string, { ts: number; results: Record<string, Result> }>();

type FoundBy = "live_redirect" | "player_response_live" | "watch_verify_live" | "none";

type Result = {
  handle: string;
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  foundBy: FoundBy;
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
  return /^[A-Za-z0-9_-]{11}$/.test(v);
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

    const m = url.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})/);
    if (m?.[1]) return m[1];

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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://www.youtube.com/",
    },
  });

  const finalUrl = res.url || url;
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, finalUrl, text };
}

function looksLikeConsentOrInterstitial(finalUrl: string, html: string): boolean {
  const u = (finalUrl || "").toLowerCase();
  const h = (html || "").toLowerCase();
  return (
    u.includes("consent.youtube.com") ||
    h.includes("before you continue") ||
    h.includes("unusual traffic") ||
    h.includes("sorry for the interruption")
  );
}

/**
 * Balanced-brace JSON extraction by key (ytInitialPlayerResponse).
 */
function extractJsonByKey(html: string, key: string): any | null {
  if (!html) return null;

  const keys = [key, `"${key}"`];

  for (const k of keys) {
    const idx = html.indexOf(k);
    if (idx < 0) continue;

    const braceStart = html.indexOf("{", idx);
    if (braceStart < 0) continue;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = braceStart; i < html.length; i++) {
      const ch = html[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const jsonText = html.slice(braceStart, i + 1);
          try {
            return JSON.parse(jsonText);
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
}

function extractPlayerResponse(html: string): any | null {
  return extractJsonByKey(html, "ytInitialPlayerResponse");
}

function readIsLiveNowFromPlayerResponse(pr: any): { isLive: boolean; videoId?: string; reason?: string } {
  if (!pr) return { isLive: false, reason: "no_player_response" };

  const videoId = pr?.videoDetails?.videoId;
  if (!videoId || !isValidVideoId(videoId)) return { isLive: false, reason: "no_valid_videoId" };

  const isLiveNow =
    pr?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true;

  if (!isLiveNow) return { isLive: false, reason: "not_live_now" };

  return { isLive: true, videoId, reason: "isLiveNow_true" };
}

/**
 * Optional: verify the videoId by fetching watch page and checking isLiveNow there too.
 * This prevents false positives if /live shows a placeholder.
 */
async function verifyWatchIsLive(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`;
  const page = await fetchHtml(watchUrl);

  const debug: any = {
    url: watchUrl,
    status: page.status,
    finalUrl: page.finalUrl,
    htmlLen: page.text?.length || 0,
  };

  if (looksLikeConsentOrInterstitial(page.finalUrl, page.text)) {
    return { ok: false, isLive: false, debug: { ...debug, blockedOrConsent: true } };
  }

  const pr = extractPlayerResponse(page.text);
  const live = readIsLiveNowFromPlayerResponse(pr);

  return {
    ok: true,
    isLive: live.isLive,
    debug: { ...debug, playerReason: live.reason, playerVideoId: pr?.videoDetails?.videoId ?? null },
  };
}

async function resolveLiveStrict(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);

  const liveUrl = `https://www.youtube.com/@${encodeURIComponent(
    h
  )}/live?hl=en&gl=US&persist_app=1&app=desktop`;

  const page = await fetchHtml(liveUrl);

  const debug: any = {
    handle: h,
    liveUrl,
    status: page.status,
    finalUrl: page.finalUrl,
    htmlLen: page.text?.length || 0,
  };

  if (looksLikeConsentOrInterstitial(page.finalUrl, page.text)) {
    return {
      handle: h,
      isLive: false,
      foundBy: "none",
      error: "blocked_or_consent",
      debug: { ...debug, blockedOrConsent: true },
    };
  }

  // 1) Redirect-based detection (best)
  const redirectedId = extractVideoIdFromUrl(page.finalUrl);
  if (redirectedId) {
    // Verify on watch page (extra safety)
    const verify = await verifyWatchIsLive(redirectedId);
    debug.watchVerify = verify.debug;

    if (verify.ok && verify.isLive) {
      return {
        handle: h,
        isLive: true,
        videoId: redirectedId,
        watchUrl: `https://www.youtube.com/watch?v=${redirectedId}`,
        foundBy: "watch_verify_live",
        debug: { ...debug, redirectedVideoId: redirectedId, verified: true },
      };
    }

    // If verify fails due to consent, still accept redirect as strong hint:
    if (!verify.ok && verify.debug?.blockedOrConsent) {
      return {
        handle: h,
        isLive: true,
        videoId: redirectedId,
        watchUrl: `https://www.youtube.com/watch?v=${redirectedId}`,
        foundBy: "live_redirect",
        debug: { ...debug, redirectedVideoId: redirectedId, verified: false, verifyBlocked: true },
      };
    }

    // Redirect happened but not actually live => treat as not live
    return {
      handle: h,
      isLive: false,
      foundBy: "none",
      debug: { ...debug, redirectedVideoId: redirectedId, verified: false, verifyIsLive: false },
    };
  }

  // 2) PlayerResponse from /live page (strict)
  const pr = extractPlayerResponse(page.text);
  const live = readIsLiveNowFromPlayerResponse(pr);

  debug.playerResponse = {
    extracted: !!pr,
    prVideoId: pr?.videoDetails?.videoId ?? null,
    prIsLiveNow: pr?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow ?? null,
    reason: live.reason,
  };

  if (live.isLive && live.videoId) {
    // Verify again on watch page
    const verify = await verifyWatchIsLive(live.videoId);
    debug.watchVerify = verify.debug;

    if (verify.ok && verify.isLive) {
      return {
        handle: h,
        isLive: true,
        videoId: live.videoId,
        watchUrl: `https://www.youtube.com/watch?v=${live.videoId}`,
        foundBy: "watch_verify_live",
        debug: { ...debug, verified: true },
      };
    }

    // If blocked by consent, accept player response
    if (!verify.ok && verify.debug?.blockedOrConsent) {
      return {
        handle: h,
        isLive: true,
        videoId: live.videoId,
        watchUrl: `https://www.youtube.com/watch?v=${live.videoId}`,
        foundBy: "player_response_live",
        debug: { ...debug, verified: false, verifyBlocked: true },
      };
    }

    // Not live when verified => not live
    return {
      handle: h,
      isLive: false,
      foundBy: "none",
      debug: { ...debug, verified: false, verifyIsLive: false },
    };
  }

  return {
    handle: h,
    isLive: false,
    foundBy: "none",
    debug,
  };
}

function cacheKeyFor(handles: string[]) {
  return [...handles].sort().join(",");
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

  const unique = Array.from(new Set(handles)).filter(Boolean);

  const key = cacheKeyFor(unique);
  const now = Date.now();

  const cached = memCache.get(key);
  if (cached && now - cached.ts < MEM_TTL_MS) {
    return NextResponse.json(
      { ok: true, results: cached.results, apiEnabled: false, cached: true },
      {
        status: 200,
        headers: {
          "Cache-Control": `public, s-maxage=${CDN_TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
        },
      }
    );
  }

  const results: Record<string, Result> = {};

  for (const h of unique) {
    try {
      const r = await resolveLiveStrict(h);
      results[r.handle] = r;
    } catch (e: any) {
      const hh = normalizeHandle(h);
      results[hh] = {
        handle: hh,
        isLive: false,
        foundBy: "none",
        error: e?.message || "unknown_error",
      };
    }
  }

  memCache.set(key, { ts: Date.now(), results });

  return NextResponse.json(
    { ok: true, results, apiEnabled: false, cached: false },
    {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${CDN_TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      },
    }
  );
}