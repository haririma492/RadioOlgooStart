import { NextResponse } from "next/server";
import { redisGet, redisSet } from "@/lib/redisLiveCache";
import { parseYouTubeTarget, type YouTubeTarget } from "@/lib/YoutubeTarget";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_VERSION = "v4-live-verified";
const LIVE_CACHE_TTL_MS = 3 * 60 * 1000;
const ALLOWLISTED_CACHE_TTL_MS = 90 * 1000;
const ALLOWLISTED_WITH_VIDEO_TTL_SEC = 90;
const QUOTA_BACKOFF_TTL_MS = 60 * 60 * 1000;
const QUOTA_BACKOFF_TTL_SEC = 60 * 60;
const DEFAULT_CACHE_TTL_SEC = 180;
const LIVE_GRACE_MS = 90 * 1000;
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const liveCache = new Map<string, { results: Record<string, Result>; ts: number; ttlMs?: number }>();

function getCacheKey(channelIds: string[], handles: string[]): string {
  return `${CACHE_VERSION}:${[...channelIds, ...handles].sort().join(",")}`;
}

function isQuotaError(message: string): boolean {
  return /quota|exceeded|limit/i.test(message || "");
}

type FoundBy =
  | "videos_list_live"
  | "search_live"
  | "redirect_verified"
  | "cached_live_grace"
  | "none";

type Result = {
  channelId?: string;
  handle?: string;
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  embedUrl?: string;
  foundBy: FoundBy;
  lastConfirmedAt?: number;
};

function isValidVideoId(v: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(v);
}

function normalizeHandle(h: string): string {
  return (h || "").trim().replace(/^@/, "");
}

function extractHandle(input: string): string | null {
  const s = (input || "").trim();
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);
  const m1 = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m1?.[1]) return normalizeHandle(m1[1]);
  const m2 = s.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9._-]+)/i);
  if (m2?.[1]) return normalizeHandle(m2[1]);
  return null;
}

const FETCH_TIMEOUT_MS = 18_000;
const SEARCH_TIMEOUT_MS = 14_000;
const VIDEOS_LIST_MAX_IDS = 50;

async function fetchRssVideoIds(channelId: string): Promise<string[]> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const res = await fetch(rssUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OlgooBot/2.0)",
        Accept: "application/atom+xml,text/xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const ids: string[] = [];
    const regex = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
    return ids.slice(0, 15);
  } catch {
    return [];
  }
}

function extractJsonByKey(html: string, key: string): Record<string, unknown> | null {
  const needle = `"${key}"`;
  const idx = html.indexOf(needle);
  if (idx === -1) return null;
  const start = html.indexOf("{", idx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const LIVE_PAGE_HEADERS = {
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
} as const;

async function fetchLiveRedirectFromUrl(liveUrl: string): Promise<string | null> {
  try {
    const res = await fetch(liveUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: LIVE_PAGE_HEADERS,
    });
    const finalUrl = res.url || liveUrl;
    const m = finalUrl.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m?.[1] && isValidVideoId(m[1])) return m[1];

    const embedMatch = finalUrl.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch?.[1] && embedMatch[1] !== "live_stream" && isValidVideoId(embedMatch[1])) {
      return embedMatch[1];
    }

    const html = await res.text();
    const canonical = html.match(
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/
    );
    if (canonical?.[1] && isValidVideoId(canonical[1])) return canonical[1];

    const ogVideo = html.match(
      /<meta property="og:video:url" content="[^"]*[?&]v=([A-Za-z0-9_-]{11})">/
    );
    if (ogVideo?.[1] && isValidVideoId(ogVideo[1])) return ogVideo[1];

    const playerResponse = extractJsonByKey(html, "ytInitialPlayerResponse");
    const details = playerResponse?.videoDetails as { videoId?: string } | undefined;
    const vid = details?.videoId;
    if (typeof vid === "string" && isValidVideoId(vid)) return vid;

    return null;
  } catch {
    return null;
  }
}

async function fetchLiveRedirectVideoId(channelId: string): Promise<string | null> {
  return fetchLiveRedirectFromUrl(`https://www.youtube.com/channel/${channelId}/live`);
}

async function fetchLiveVideoIdBySearch(
  channelId: string,
  apiKey: string,
  opts?: { lastError?: { channelId: string; message: string } }
): Promise<string | null> {
  if (!apiKey) {
    if (opts?.lastError) opts.lastError.message = "no_api_key";
    return null;
  }

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&eventType=live&maxResults=5` +
    `&key=${encodeURIComponent(apiKey)}`;

  const doSearch = async (): Promise<string | null> => {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg =
        json?.error?.message || json?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
      if (opts?.lastError) {
        opts.lastError.channelId = channelId;
        opts.lastError.message = errMsg;
      }
      return null;
    }
    const items = Array.isArray(json?.items) ? json.items : [];
    for (const item of items) {
      const id = item?.id?.videoId;
      if (typeof id === "string" && isValidVideoId(id)) return id;
    }
    if (opts?.lastError && items.length === 0) {
      opts.lastError.channelId = channelId;
      opts.lastError.message = "no_live_items";
    }
    return null;
  };

  try {
    let id = await doSearch();
    if (id) return id;
    await new Promise((r) => setTimeout(r, 800));
    id = await doSearch();
    return id ?? null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (opts?.lastError) {
      opts.lastError.channelId = channelId;
      opts.lastError.message = msg;
    }
    return null;
  }
}

type VideoLiveInfo = {
  videoId: string;
  isLive: boolean;
};

async function batchCheckLiveness(videoIds: string[], apiKey: string): Promise<VideoLiveInfo[]> {
  if (videoIds.length === 0 || !apiKey) return [];
  const unique = Array.from(new Set(videoIds)).filter(isValidVideoId);
  if (unique.length === 0) return [];

  const out: VideoLiveInfo[] = [];

  for (let i = 0; i < unique.length; i += VIDEOS_LIST_MAX_IDS) {
    const chunk = unique.slice(i, i + VIDEOS_LIST_MAX_IDS);
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=liveStreamingDetails&id=${encodeURIComponent(chunk.join(","))}` +
      `&key=${encodeURIComponent(apiKey)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) continue;

      const items: Array<{ id?: string; liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string } }> =
        Array.isArray(json.items) ? json.items : [];

      for (const it of items) {
        const lsd = it?.liveStreamingDetails;
        const started = lsd?.actualStartTime ? Date.parse(lsd.actualStartTime) : NaN;
        const ended = lsd?.actualEndTime ? Date.parse(lsd.actualEndTime) : NaN;
        const isLive = Number.isFinite(started) && !Number.isFinite(ended);
        if (typeof it.id === "string") out.push({ videoId: it.id, isLive });
      }
    } catch {
      // skip chunk
    }
  }

  return out;
}

function applyStickyLiveGrace(
  fresh: Record<string, Result>,
  previous: Record<string, Result> | undefined,
  now: number
): Record<string, Result> {
  if (!previous) return fresh;
  const merged: Record<string, Result> = { ...fresh };

  for (const [key, prev] of Object.entries(previous)) {
    const next = merged[key];
    const stillFresh = !!prev.lastConfirmedAt && now - prev.lastConfirmedAt <= LIVE_GRACE_MS;
    const trustworthyPrev = ["videos_list_live", "search_live", "redirect_verified", "cached_live_grace"].includes(prev.foundBy);

    if (
      prev.isLive &&
      prev.videoId &&
      stillFresh &&
      trustworthyPrev &&
      (!next || !next.isLive)
    ) {
      merged[key] = {
        ...prev,
        foundBy: "cached_live_grace",
      };
    }
  }

  return merged;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const channelIdsParam = searchParams.get("channelIds") || "";
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";

  type ChannelEntry = { channelId?: string; handle?: string; key: string };
  const entries: ChannelEntry[] = [];

  if (channelIdsParam) {
    for (const part of channelIdsParam.split(",")) {
      const [cid, handle] = part.trim().split(":");
      if (cid && cid.startsWith("UC")) entries.push({ channelId: cid, handle: handle || undefined, key: cid });
    }
  }

  const rawHandles = [
    ...(handlesParam ? handlesParam.split(",") : []),
    ...(inputsParam ? inputsParam.split(",") : []),
  ]
    .map((x) => extractHandle(x))
    .filter((x): x is string => !!x);

  for (const h of Array.from(new Set(rawHandles))) {
    if (!entries.find((e) => e.handle === h)) entries.push({ handle: h, key: h });
  }

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, results: {} }, { headers: NO_CACHE_HEADERS });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || "";
  const ALWAYS_LIVE_HANDLES = new Set(["IRANINTL"]);
  const ALWAYS_LIVE_CHANNEL_IDS = new Set(["UCat6bC0Wrqq9Bcq7EkH_yQw"]);
  const HANDLE_TO_CHANNEL: Record<string, string> = {
    IRANINTL: "UCat6bC0Wrqq9Bcq7EkH_yQw",
  };

  for (const e of entries) {
    if (e.handle && !e.channelId && HANDLE_TO_CHANNEL[e.handle]) e.channelId = HANDLE_TO_CHANNEL[e.handle];
  }

  const hasAllowlistedChannel = entries.some(
    (e) =>
      (e.handle && ALWAYS_LIVE_HANDLES.has(e.handle)) ||
      (e.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(e.channelId))
  );

  const cacheKey = getCacheKey(
    entries.filter((e) => e.channelId).map((e) => e.channelId!),
    entries.filter((e) => !e.channelId).map((e) => e.handle!)
  );

  let previousResults: Record<string, Result> | undefined;
  try {
    const raw = await redisGet(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { results?: Record<string, Result> };
      if (parsed?.results) previousResults = parsed.results;
    }
  } catch {
    // ignore
  }

  const cached = liveCache.get(cacheKey);
  const cacheTtlMs = hasAllowlistedChannel ? ALLOWLISTED_CACHE_TTL_MS : LIVE_CACHE_TTL_MS;
  const effectiveTtlMs = cached?.ttlMs ?? cacheTtlMs;

  if (cached && Date.now() - cached.ts < effectiveTtlMs) {
    return NextResponse.json({ ok: true, results: cached.results, cached: true }, { headers: NO_CACHE_HEADERS });
  }

  const resolvedEntries: Array<ChannelEntry & { channelId: string }> = entries.filter(
    (e): e is ChannelEntry & { channelId: string } => !!e.channelId
  );

  const byChannelId = new Map<string, ChannelEntry & { channelId: string }>();
  for (const e of resolvedEntries) {
    const existing = byChannelId.get(e.channelId);
    if (!existing || e.handle) byChannelId.set(e.channelId, e);
  }
  const resolvedEntriesUnique = Array.from(byChannelId.values());

  const discoveryResults = await Promise.all(
    resolvedEntriesUnique.map(async (entry) => {
      const [rssIds, redirectFromChannel] = await Promise.all([
        fetchRssVideoIds(entry.channelId),
        fetchLiveRedirectVideoId(entry.channelId),
      ]);

      let redirectId = redirectFromChannel;
      if (!redirectId && entry.handle) {
        redirectId = await fetchLiveRedirectFromUrl(`https://www.youtube.com/@${entry.handle}/live`);
      }
      if (!redirectId && entry.channelId) {
        redirectId = await fetchLiveRedirectFromUrl(
          `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(entry.channelId)}`
        );
      }

      const videoIds = [...rssIds];
      if (redirectId && !videoIds.includes(redirectId)) videoIds.push(redirectId);
      return { entry, videoIds, redirectId };
    })
  );

  const allVideoIds = Array.from(new Set(discoveryResults.flatMap((r) => r.videoIds)));
  const liveness = apiKey ? await batchCheckLiveness(allVideoIds, apiKey) : [];
  const liveSet = new Set(liveness.filter((v) => v.isLive).map((v) => v.videoId));

  const allowlistedNeedingSearch = discoveryResults.filter((d) => {
    const liveFromApi = d.videoIds.find((id) => liveSet.has(id));
    const redirectVerifiedLive = !!d.redirectId && liveSet.has(d.redirectId);
    const isAlwaysLive =
      (d.entry.handle && ALWAYS_LIVE_HANDLES.has(d.entry.handle)) ||
      (d.entry.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(d.entry.channelId));
    return isAlwaysLive && !liveFromApi && !redirectVerifiedLive && !!d.entry.channelId;
  });

  const searchLastError = { channelId: "", message: "" };
  const searchResults = await Promise.all(
    allowlistedNeedingSearch.map(async (d) => ({
      channelId: d.entry.channelId,
      videoId: await fetchLiveVideoIdBySearch(d.entry.channelId, apiKey, { lastError: searchLastError }),
    }))
  );

  const liveVideoIdByChannel = new Map<string, string>();
  for (const { channelId, videoId } of searchResults) {
    if (videoId) liveVideoIdByChannel.set(channelId, videoId);
  }

  const now = Date.now();
  let results: Record<string, Result> = {};

  for (const { entry, videoIds, redirectId } of discoveryResults) {
    const liveFromApi = videoIds.find((id) => liveSet.has(id));
    const searchLive = entry.channelId ? liveVideoIdByChannel.get(entry.channelId) : undefined;
    const redirectVerifiedLive = redirectId && liveSet.has(redirectId) ? redirectId : undefined;

    const key = entry.handle || entry.channelId;
    const effectiveVideoId = liveFromApi ?? searchLive ?? redirectVerifiedLive ?? undefined;

    let foundBy: FoundBy = "none";
    if (liveFromApi) foundBy = "videos_list_live";
    else if (searchLive) foundBy = "search_live";
    else if (redirectVerifiedLive) foundBy = "redirect_verified";

    const isLive = !!effectiveVideoId;
    const watchUrl = effectiveVideoId ? `https://www.youtube.com/watch?v=${effectiveVideoId}` : undefined;

    results[key] = {
      channelId: entry.channelId,
      handle: entry.handle,
      isLive,
      videoId: effectiveVideoId,
      watchUrl,
      embedUrl: undefined,
      foundBy,
      lastConfirmedAt: isLive ? now : undefined,
    };
  }

  for (const entry of entries) {
    const key = entry.handle || entry.channelId;
    if (!key || results[key]) continue;

    const channelAlreadyInResults =
      entry.channelId && Object.values(results).some((r) => r.channelId === entry.channelId);
    if (channelAlreadyInResults) continue;

    results[key] = {
      channelId: entry.channelId,
      handle: entry.handle,
      isLive: false,
      foundBy: "none",
    };
  }

  results = applyStickyLiveGrace(results, previousResults, now);
  if (cached?.results) results = applyStickyLiveGrace(results, cached.results, now);

  const quotaExceeded = isQuotaError(searchLastError.message);
  liveCache.set(cacheKey, {
    results,
    ts: now,
    ttlMs: quotaExceeded ? QUOTA_BACKOFF_TTL_MS : undefined,
  });

  const iranintlHasVideo = !!results["IRANINTL"]?.videoId || !!results["UCat6bC0Wrqq9Bcq7EkH_yQw"]?.videoId;
  const ttlSec = quotaExceeded
    ? QUOTA_BACKOFF_TTL_SEC
    : hasAllowlistedChannel && iranintlHasVideo
      ? ALLOWLISTED_WITH_VIDEO_TTL_SEC
      : DEFAULT_CACHE_TTL_SEC;

  await redisSet(cacheKey, JSON.stringify({ results, storedAt: now, version: CACHE_VERSION }), ttlSec);

  const debugParam = searchParams.get("debug");
  const body: { ok: boolean; results: Record<string, Result>; debug?: object } = { ok: true, results };
  if (debugParam === "1" || debugParam === "true") {
    body.debug = {
      cacheVersion: CACHE_VERSION,
      entriesCount: entries.length,
      entriesWithChannelId: entries.filter((e) => e.channelId).length,
      apiKeySet: !!apiKey,
      resolvedCount: resolvedEntriesUnique.length,
      allowlistedNeedingSearchCount: allowlistedNeedingSearch.length,
      searchResultByChannel: Object.fromEntries(liveVideoIdByChannel),
      searchLastError: searchLastError.message
        ? { channelId: searchLastError.channelId, message: searchLastError.message }
        : undefined,
      quotaBackoff: quotaExceeded,
      iranintlResult: results["IRANINTL"] ?? results["UCat6bC0Wrqq9Bcq7EkH_yQw"],
    };
  }

  return NextResponse.json(body, { headers: NO_CACHE_HEADERS });
}
