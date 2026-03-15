// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";
import { redisGet, redisSet } from "@/lib/redisLiveCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Cache ──────────────────────────────────────────────────────────────────
const LIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const ALLOWLISTED_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const ALLOWLISTED_WITH_VIDEO_TTL_SEC = 2 * 60; // 2 minutes
const QUOTA_BACKOFF_TTL_MS = 60 * 60 * 1000; // 1 hour when quota exceeded
const QUOTA_BACKOFF_TTL_SEC = 60 * 60;
const DEFAULT_CACHE_TTL_SEC = 2 * 60; // 2 minutes

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const liveCache = new Map<
  string,
  { results: Record<string, Result>; ts: number; ttlMs?: number }
>();

function getCacheKey(channelIds: string[], handles: string[]): string {
  return [...channelIds, ...handles].sort().join(",");
}

function isQuotaError(message: string): boolean {
  return /quota|exceeded|limit/i.test(message || "");
}

// ── Types ────────────────────────────────────────────────────────────────
type FoundBy = "rss_videos_list" | "none";

type Result = {
  channelId?: string;
  handle?: string;
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  embedUrl?: string;
  foundBy: FoundBy;
};

type ChannelEntry = { channelId?: string; handle?: string; key: string };


// ── Helpers ────────────────────────────────────────────────────────────────
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
  const m3 = s.match(/\/channel\/(UC[A-Za-z0-9_-]+)/i);
  if (m3?.[1]) return null;
  return null;
}

function extractChannelId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^UC[A-Za-z0-9_-]+$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/channel\/)(UC[A-Za-z0-9_-]+)/i);
  return m?.[1] ?? null;
}

async function resolveHandleToChannelId(handle: string, apiKey: string): Promise<string | null> {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;

  if (apiKey) {
    try {
      const byHandleUrl =
        `https://www.googleapis.com/youtube/v3/channels` +
        `?part=id&forHandle=${encodeURIComponent(normalized)}` +
        `&key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(byHandleUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const json = await res.json().catch(() => null);
      const channelId = json?.items?.[0]?.id;
      if (typeof channelId === "string" && channelId.startsWith("UC")) {
        return channelId;
      }
    } catch {
      // continue to page fallback
    }
  }

  try {
    const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(normalized)}`, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: LIVE_PAGE_HEADERS,
    });
    const finalUrl = res.url || "";
    const fromFinalUrl = extractChannelId(finalUrl);
    if (fromFinalUrl) return fromFinalUrl;

    const html = await res.text();
    const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)"/i);
    if (canonicalMatch?.[1]) return canonicalMatch[1];

    const channelIdMatch = html.match(/"channelId":"(UC[A-Za-z0-9_-]+)"/);
    if (channelIdMatch?.[1]) return channelIdMatch[1];

    const browseIdMatch = html.match(/"browseId":"(UC[A-Za-z0-9_-]+)"/);
    if (browseIdMatch?.[1]) return browseIdMatch[1];
  } catch {
    // ignore
  }

  return null;
}

async function resolveMissingChannelIds(entries: ChannelEntry[], apiKey: string): Promise<void> {
  const unresolved = entries.filter((e) => e.handle && !e.channelId);
  if (unresolved.length === 0) return;

  const resolved = await Promise.all(
    unresolved.map(async (entry) => ({
      entry,
      channelId: await resolveHandleToChannelId(entry.handle!, apiKey),
    }))
  );

  for (const item of resolved) {
    if (item.channelId) {
      item.entry.channelId = item.channelId;
    }
  }
}

// ── Step 1: Fetch RSS feed and extract video IDs ───────────────────────────
const FETCH_TIMEOUT_MS = 18_000;

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

// ── Step 1.5: Catch 24/7 permanent live streams ────────────────────────────
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

const SEARCH_TIMEOUT_MS = 14_000;

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

// ── Step 2: Batch video liveness check ─────────────────────────────────────
const VIDEOS_LIST_MAX_IDS = 50;

type VideoLiveInfo = {
  videoId: string;
  isLive: boolean;
};

async function batchCheckLiveness(videoIds: string[], apiKey: string): Promise<VideoLiveInfo[]> {
  if (videoIds.length === 0) return [];
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
        if (typeof it.id === "string") {
          out.push({ videoId: it.id, isLive });
        }
      }
    } catch {
      // skip chunk on error
    }
  }

  return out;
}

// ── Main GET handler ───────────────────────────────────────────────────────
export async function GET(req: Request) {
  console.log(
    "[yt-live][GET] hasKey=",
    !!process.env.YOUTUBE_API_KEY,
    "len=",
    (process.env.YOUTUBE_API_KEY || "").length
  );

  const { searchParams } = new URL(req.url);

  const channelIdsParam = searchParams.get("channelIds") || "";
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";

  const entries: ChannelEntry[] = [];

  if (channelIdsParam) {
    for (const part of channelIdsParam.split(",")) {
      const [cid, handle] = part.trim().split(":");
      if (cid && cid.startsWith("UC")) {
        entries.push({ channelId: cid, handle: handle || undefined, key: cid });
      }
    }
  }

  const rawHandles = [
    ...(handlesParam ? handlesParam.split(",") : []),
    ...(inputsParam ? inputsParam.split(",") : []),
  ]
    .map((x) => extractHandle(x))
    .filter((x): x is string => !!x);

  for (const h of Array.from(new Set(rawHandles))) {
    if (!entries.find((e) => e.handle === h)) {
      entries.push({ handle: h, key: h });
    }
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
    if (e.handle && !e.channelId && HANDLE_TO_CHANNEL[e.handle]) {
      e.channelId = HANDLE_TO_CHANNEL[e.handle];
    }
  }

  await resolveMissingChannelIds(entries, apiKey);

  fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "youtube/live/route.ts:entries-after-fallback",
      message: "entries after handle->channelId fallback",
      data: {
        entriesCount: entries.length,
        withChannelId: entries.filter((e) => e.channelId).length,
        apiKeySet: !!apiKey,
      },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});

  const hasAllowlistedChannel = entries.some(
    (e) =>
      (e.handle && ALWAYS_LIVE_HANDLES.has(e.handle)) ||
      (e.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(e.channelId))
  );

  const cacheKey = getCacheKey(
    entries.filter((e) => e.channelId).map((e) => e.channelId!),
    entries.filter((e) => !e.channelId).map((e) => e.handle!)
  );

  try {
    const raw = await redisGet(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { results?: Record<string, Result> };
      if (parsed?.results) {
        return NextResponse.json(
          { ok: true, results: parsed.results, cached: true },
          { headers: NO_CACHE_HEADERS }
        );
      }
    }
  } catch {
    // Redis miss or error
  }

  const cached = liveCache.get(cacheKey);
  const cacheTtlMs = hasAllowlistedChannel ? ALLOWLISTED_CACHE_TTL_MS : LIVE_CACHE_TTL_MS;
  const effectiveTtlMs = cached?.ttlMs ?? cacheTtlMs;

  if (cached && Date.now() - cached.ts < effectiveTtlMs) {
    return NextResponse.json(
      { ok: true, results: cached.results, cached: true },
      { headers: NO_CACHE_HEADERS }
    );
  }

  const resolvableEntries = entries.filter((e) => !!e.channelId || !!e.handle);

  const byDiscoveryKey = new Map<string, ChannelEntry>();
  for (const e of resolvableEntries) {
    const discoveryKey = e.channelId || e.handle;
    if (!discoveryKey) continue;

    const existing = byDiscoveryKey.get(discoveryKey);
    if (!existing || (!!e.channelId && !existing.channelId) || (!!e.handle && !existing.handle)) {
      byDiscoveryKey.set(discoveryKey, e);
    }
  }
  const resolvedEntriesUnique = Array.from(byDiscoveryKey.values());

  const discoveryResults = await Promise.all(
    resolvedEntriesUnique.map(async (entry) => {
      const [rssIds, redirectFromChannel, redirectFromHandle] = await Promise.all([
        entry.channelId ? fetchRssVideoIds(entry.channelId) : Promise.resolve([]),
        entry.channelId ? fetchLiveRedirectVideoId(entry.channelId) : Promise.resolve(null),
        entry.handle ? fetchLiveRedirectFromUrl(`https://www.youtube.com/@${entry.handle}/live`) : Promise.resolve(null),
      ]);

      let redirectId = redirectFromHandle || redirectFromChannel;

      if (!redirectId && entry.channelId) {
        redirectId = await fetchLiveRedirectFromUrl(
          `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(entry.channelId)}`
        );
      }

      const videoIds = [...rssIds];
      if (redirectId && !videoIds.includes(redirectId)) {
        videoIds.push(redirectId);
      }

      return { entry, videoIds, redirectId };
    })
  );

  const allVideoIds = Array.from(new Set(discoveryResults.flatMap((r) => r.videoIds)));
  const liveness = apiKey ? await batchCheckLiveness(allVideoIds, apiKey) : [];
  const liveSet = new Set(liveness.filter((v) => v.isLive).map((v) => v.videoId));

  const allowlistedNeedingSearch = discoveryResults.filter((d) => {
    const liveFromApi = d.videoIds.find((id) => liveSet.has(id));
    const isAlwaysLive =
      (d.entry.handle && ALWAYS_LIVE_HANDLES.has(d.entry.handle)) ||
      (d.entry.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(d.entry.channelId));
    return isAlwaysLive && !liveFromApi && !!d.entry.channelId;
  });

  const searchLastError = { channelId: "", message: "" };

  const searchResults = await Promise.all(
    allowlistedNeedingSearch.map(async (d) => ({
      channelId: d.entry.channelId,
      videoId: await fetchLiveVideoIdBySearch(d.entry.channelId, apiKey, {
        lastError: searchLastError,
      }),
    }))
  );

  const liveVideoIdByChannel = new Map<string, string>();
  for (const { channelId, videoId } of searchResults) {
    if (videoId) liveVideoIdByChannel.set(channelId, videoId);
  }

  fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "youtube/live/route.ts:after-search",
      message: "search.list results for allowlisted channels",
      data: {
        allowlistedNeedingSearchCount: allowlistedNeedingSearch.length,
        searchResultMap: Object.fromEntries(liveVideoIdByChannel),
      },
      timestamp: Date.now(),
      hypothesisId: "B",
    }),
  }).catch(() => {});

  const results: Record<string, Result> = {};

  for (const { entry, videoIds, redirectId } of discoveryResults) {
    const liveFromApi = videoIds.find((id) => liveSet.has(id));

    const key = entry.handle || entry.channelId;

    const effectiveVideoId =
      liveFromApi ??
      (entry.channelId ? liveVideoIdByChannel.get(entry.channelId) : undefined) ??
      (redirectId && isValidVideoId(redirectId) ? redirectId : undefined);

    const isLive = !!effectiveVideoId;

    const watchUrl = effectiveVideoId
      ? `https://www.youtube.com/watch?v=${effectiveVideoId}`
      : undefined;

    const embedUrl: string | undefined = undefined;

    results[key] = {
      channelId: entry.channelId,
      handle: entry.handle,
      isLive,
      videoId: effectiveVideoId,
      watchUrl,
      embedUrl,
      foundBy: effectiveVideoId ? "rss_videos_list" : "none",
    };

    if (key === "IRANINTL" || entry.channelId === "UCat6bC0Wrqq9Bcq7EkH_yQw") {
      fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "youtube/live/route.ts:result-IRANINTL",
          message: "IRANINTL result built",
          data: {
            key,
            effectiveVideoId: !!effectiveVideoId,
            embedUrl: !!embedUrl,
            isLive,
            watchUrl,
          },
          timestamp: Date.now(),
          hypothesisId: "C",
        }),
      }).catch(() => {});
    }
  }

  for (const entry of entries) {
    const key = entry.handle || entry.channelId;
    if (!key) continue;
    if (results[key]) continue;

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

  const quotaExceeded = isQuotaError(searchLastError.message);

  liveCache.set(cacheKey, {
    results,
    ts: Date.now(),
    ttlMs: quotaExceeded ? QUOTA_BACKOFF_TTL_MS : undefined,
  });

  const iranintlHasVideo =
    !!results["IRANINTL"]?.videoId || !!results["UCat6bC0Wrqq9Bcq7EkH_yQw"]?.videoId;

  const ttlSec = quotaExceeded
    ? QUOTA_BACKOFF_TTL_SEC
    : hasAllowlistedChannel && iranintlHasVideo
      ? ALLOWLISTED_WITH_VIDEO_TTL_SEC
      : DEFAULT_CACHE_TTL_SEC;

  await redisSet(cacheKey, JSON.stringify({ results }), ttlSec);

  const debugParam = searchParams.get("debug");
  const body: { ok: boolean; results: Record<string, Result>; debug?: object } = {
    ok: true,
    results,
  };

  if (debugParam === "1" || debugParam === "true") {
    body.debug = {
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

  return NextResponse.json(body, {
    headers: NO_CACHE_HEADERS,
  });
}