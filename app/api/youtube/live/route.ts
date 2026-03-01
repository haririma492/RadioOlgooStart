// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type FoundBy = "yt_api_live" | "yt_api_no_live" | "live_redirect" | "live_html_signals" | "streams_html_signals" | "none";
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

  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);

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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      Referer: "https://www.youtube.com/",
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
 * Extract a JSON object from HTML by key (e.g. ytInitialPlayerResponse or ytInitialData).
 * Balanced-brace extraction (safe, no regex-dotall).
 */
function extractJsonByKey(html: string, key: string, keyQuoted?: string): any | null {
  if (!html) return null;

  const keys = keyQuoted ? [key, keyQuoted] : [key, `"${key}"`];

  for (const k of keys) {
    const idx = html.indexOf(k);
    if (idx < 0) continue;

    const braceStart = html.indexOf("{", idx);
    if (braceStart < 0) continue;

    let i = braceStart;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (; i < html.length; i++) {
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
  return extractJsonByKey(html, "ytInitialPlayerResponse", '"ytInitialPlayerResponse"');
}

/**
 * Fallback: try to get current live videoId from ytInitialData when player response is missing/empty.
 * Used when deployed env gets different HTML (e.g. no ytInitialPlayerResponse).
 */
function extractLiveVideoIdFromInitialData(html: string): string | null {
  const data = extractJsonByKey(html, "ytInitialData", '"ytInitialData"');
  if (!data?.contents?.twoColumnBrowseResultsRenderer?.tabs) return null;

  const tabs = data.contents.twoColumnBrowseResultsRenderer.tabs as any[];
  for (const tab of tabs) {
    const grid = tab?.tabRenderer?.content?.richGridRenderer?.contents;
    if (!Array.isArray(grid)) continue;
    for (const item of grid) {
      const vid = item?.richItemRenderer?.content?.videoRenderer?.videoId;
      if (typeof vid === "string" && isValidVideoId(vid)) return vid;
    }
  }
  return null;
}

function isLiveNowFromPlayerResponse(pr: any): { isLive: boolean; videoId?: string; reason?: string } {
  if (!pr) return { isLive: false, reason: "no_player_response" };

  const videoId = pr.videoDetails?.videoId;
  if (!videoId || !isValidVideoId(videoId)) return { isLive: false, reason: "no_valid_videoId" };

  const isLiveContent = pr.videoDetails?.isLiveContent === true;
  const isLiveNow = pr.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true;
  const hasLiveStreamingDetails = !!pr.liveStreamingDetails;

  const isLive = isLiveNow || (isLiveContent && hasLiveStreamingDetails);

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

  // 2) Structured player response (safe-ish; works on localhost, may fail on Vercel)
  const pr = extractPlayerResponse(page.text);
  debugEntry.playerResponse = {
    extracted: !!pr,
    videoId: pr?.videoDetails?.videoId ?? null,
    isLiveContent: pr?.videoDetails?.isLiveContent ?? null,
    isLiveNow: pr?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow ?? null,
    hasLiveStreamingDetails: !!pr?.liveStreamingDetails,
  };

  let live = isLiveNowFromPlayerResponse(pr);

  // 2b) Fallback when deploy gets different HTML: try ytInitialData for first video (often live tab)
  if (!live.isLive && page.text) {
    const fallbackVideoId = extractLiveVideoIdFromInitialData(page.text);
    if (fallbackVideoId) {
      live = { isLive: true, videoId: fallbackVideoId, reason: "live" };
      debugEntry.playerResponseFallback = "ytInitialData";
    }
  }

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

async function resolveLiveHtmlFallback(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h, mode: "html_fallback" };
  let candidatesChecked = 0;

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
      foundBy: (liveResult.foundBy as FoundBy) || "none",
      candidatesChecked,
      debug,
    };
  }

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
      foundBy: (streamsResult.foundBy as FoundBy) || "none",
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

/** ───────────── API-only live check (Vercel-safe) ───────────── */

type ApiLiveItem = {
  videoId: string;
  channelId: string;
};

async function ytApiJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.error?.message || `YouTube API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Deterministic live check for a channelId.
 * Cost: search.list ~= 100 units per call.
 */
async function isChannelLiveById(channelId: string, apiKey: string): Promise<ApiLiveItem | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(
      channelId
    )}&eventType=live&type=video&maxResults=1&key=${encodeURIComponent(apiKey)}`;

  const json = await ytApiJson(url);
  const item = json?.items?.[0];
  const videoId = item?.id?.videoId;

  if (typeof videoId === "string" && isValidVideoId(videoId)) {
    return { videoId, channelId };
  }
  return null;
}

/**
 * Resolve channelId from handle using YouTube API search (best-effort).
 * For your 5 critical channels, you should store channelIds in your list/config later.
 */
async function resolveChannelIdFromHandle(handle: string, apiKey: string): Promise<string | null> {
  const h = normalizeHandle(handle);

  // ✅ Deterministic handle -> channelId
  // Docs: channels.list supports `forHandle` (value can include or omit '@')
  const url =
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
      "@" + h
    )}&key=${encodeURIComponent(apiKey)}`;

  const json = await ytApiJson(url);
  const channelId = json?.items?.[0]?.id;

  if (typeof channelId === "string" && channelId.startsWith("UC")) return channelId;
  return null;
}

/**
 * API-first resolve:
 * - If you provide channelIds as inputs, it will be fully deterministic.
 * - If only handles are provided, channelId resolution is best-effort (still better than HTML on Vercel).
 */
async function resolveLiveApi(handle: string, apiKey: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h, mode: "yt_api", hasKey: true };

  const channelId = await resolveChannelIdFromHandle(h, apiKey);
  debug.channelId = channelId;

  if (!channelId) {
    return {
      handle: h,
      isLive: false,
      foundBy: "yt_api_no_live",
      candidatesChecked: 0,
      debug,
      error: "channelId_not_resolved",
    };
  }

  const live = await isChannelLiveById(channelId, apiKey);
  debug.live = live ? { videoId: live.videoId } : null;

  if (live?.videoId) {
    return {
      handle: h,
      isLive: true,
      videoId: live.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${live.videoId}`,
      foundBy: "yt_api_live",
      candidatesChecked: 0,
      debug,
    };
  }

  return {
    handle: h,
    isLive: false,
    foundBy: "yt_api_no_live",
    candidatesChecked: 0,
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

  const apiKey = process.env.YOUTUBE_API_KEY || "";
  const apiEnabled = apiKey.length > 0;

  for (const h of unique) {
    try {
      // Vercel-safe: API first if key exists
      const r = apiEnabled ? await resolveLiveApi(h, apiKey) : await resolveLiveHtmlFallback(h);

      // If API fails to resolve, fallback to HTML ONLY if no key (keep cloud clean).
      // (We intentionally do NOT scrape HTML on Vercel when API key exists.)
      results[r.handle] = r;
    } catch (e: any) {
      const hh = normalizeHandle(h);
      const errMsg = e?.message || "";

      // When API quota is exceeded, fall back to HTML so 24/7 channels (e.g. Iran International) can still show as live
      if (apiEnabled && (errMsg.includes("quota") || errMsg.includes("exceeded"))) {
        try {
          // #region agent log
          fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "app/api/youtube/live/route.ts:quota_fallback",
              message: "API quota exceeded, using HTML fallback",
              data: { handle: hh },
              timestamp: Date.now(),
              hypothesisId: "quota_fallback",
            }),
          }).catch(() => {});
          // #endregion
          const r = await resolveLiveHtmlFallback(h);
          // #region agent log
          fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "app/api/youtube/live/route.ts:html_fallback_result",
              message: "HTML fallback result",
              data: { handle: r.handle, isLive: r.isLive, foundBy: r.foundBy },
              timestamp: Date.now(),
              hypothesisId: "quota_fallback",
            }),
          }).catch(() => {});
          // #endregion
          results[r.handle] = r;
        } catch (fallbackErr: any) {
          results[hh] = {
            handle: hh,
            isLive: false,
            foundBy: "none",
            candidatesChecked: 0,
            error: fallbackErr?.message || "html_fallback_failed",
            debug: { apiEnabled, quotaFallback: true },
          };
        }
      } else {
        results[hh] = {
          handle: hh,
          isLive: false,
          foundBy: "none",
          candidatesChecked: 0,
          error: errMsg || "unknown_error",
          debug: { apiEnabled },
        };
      }
    }
  }

  return NextResponse.json(
    { ok: true, results, apiEnabled },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}