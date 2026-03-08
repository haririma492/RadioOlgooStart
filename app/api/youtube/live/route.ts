// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";
import { redisGet, redisSet } from "@/lib/redisLiveCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Cache ──────────────────────────────────────────────────────────────────
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ALLOWLISTED_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min for allowlisted
const ALLOWLISTED_WITH_VIDEO_TTL_SEC = 30 * 60; // 30 min when we have videoId for allowlisted — fewer search.list calls
const QUOTA_BACKOFF_TTL_MS = 60 * 60 * 1000; // 1 hour when quota exceeded
const QUOTA_BACKOFF_TTL_SEC = 60 * 60;
const DEFAULT_CACHE_TTL_SEC = 10 * 60; // 10 min
const liveCache = new Map<string, { results: Record<string, Result>; ts: number; ttlMs?: number }>();

function getCacheKey(channelIds: string[], handles: string[]): string {
  return [...channelIds, ...handles].sort().join(",");
}

function isQuotaError(message: string): boolean {
  return /quota|exceeded|limit/i.test(message || "");
}

// ── Types ──────────────────────────────────────────────────────────────────
type FoundBy = "rss_videos_list" | "none";
type Result = {
  channelId?: string;
  handle?: string;
  isLive: boolean;
  videoId?: string;
  watchUrl?: string;
  /** When set, frontend should use this for iframe src (channel live_stream embed); avoids "video unavailable" when videoId is wrong or unembedable */
  embedUrl?: string;
  foundBy: FoundBy;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function isValidVideoId(v: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(v);
}

function normalizeHandle(h: string) {
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
  if (m3?.[1]) return null; // It's a channelId, not a handle
  return null;
}

function extractChannelId(input: string): string | null {
  const m = (input || "").match(/\/channel\/(UC[A-Za-z0-9_-]+)/i);
  return m?.[1] || null;
}

// ── Step 1: Fetch RSS feed and extract video IDs (FREE — zero quota) ────────
const FETCH_TIMEOUT_MS = 18_000; // Vercel serverless can be slow; avoid early timeouts

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
    // Extract <yt:videoId> tags
    const ids: string[] = [];
    const regex = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
    return ids.slice(0, 15); // Check top 15 recent videos
  } catch {
    return [];
  }
}

// ── Step 1.5: Catch 24/7 permanent live streams (FREE — zero quota) ───────
/**
 * Channels like Iran International have a permanent live stream that is NEVER
 * in the RSS feed (because it's years old).
 * We fetch the /live URL and see if it redirects to a /watch?v= ID, or parse HTML.
 * From Vercel (datacenter IP) YouTube often returns 200 + HTML instead of redirect; we parse multiple patterns.
 */
/** Extract first JSON object for a given key from HTML (e.g. ytInitialPlayerResponse) via balanced braces */
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

/** Fetch a /live URL and extract the current stream video ID (redirect or HTML). */
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
    if (embedMatch?.[1] && embedMatch[1] !== "live_stream" && isValidVideoId(embedMatch[1]))
      return embedMatch[1];

    const html = await res.text();
    const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/);
    if (canonical?.[1] && isValidVideoId(canonical[1])) return canonical[1];
    const ogVideo = html.match(/<meta property="og:video:url" content="[^"]*[?&]v=([A-Za-z0-9_-]{11})">/);
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

const SEARCH_TIMEOUT_MS = 14_000; // Vercel serverless: allow time for cold start + API response

/** Get current live video ID for a channel via search.list (eventType=live). Live component only — no uploads playlist. */
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
      const errMsg = json?.error?.message || json?.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
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

// ── Step 2: Batch video liveness check via videos.list (1 unit per 50 IDs, max 50 per request) ─
const VIDEOS_LIST_MAX_IDS = 50;
type VideoLiveInfo = { videoId: string; isLive: boolean };

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
      const items: any[] = Array.isArray(json.items) ? json.items : [];
      for (const it of items) {
        const lsd = it?.liveStreamingDetails;
        const started = lsd?.actualStartTime ? Date.parse(lsd.actualStartTime) : NaN;
        const ended = lsd?.actualEndTime ? Date.parse(lsd.actualEndTime) : NaN;
        const isLive = Number.isFinite(started) && !Number.isFinite(ended);
        out.push({ videoId: it.id as string, isLive });
      }
    } catch {
      // skip chunk on error
    }
  }
  return out;
}

// ── Main GET handler ─────────────────────────────────────────────────────
// Quota design: 0 channels.list, 0 search.list. Only videos.list (1 unit per 50 IDs).
// Channel IDs must be provided via ?channelIds= (from DynamoDB). Target: ~3000 units/day for 9 channels.
export async function GET(req: Request) {
  // ✅ MUST be inside GET() to show per-request on Vercel
  console.log(
    "[yt-live][GET] hasKey=",
    !!process.env.YOUTUBE_API_KEY,
    "len=",
    (process.env.YOUTUBE_API_KEY || "").length
  );

  const { searchParams } = new URL(req.url);

  // Accept channelIds directly (preferred, zero quota) or handles (fallback, 1 unit each)
  const channelIdsParam = searchParams.get("channelIds") || "";
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";

  // Parse channelId→handle pairs (format: UCxxx:handle or UCxxx)
  // Also accept raw channelId list and raw handle list
  type ChannelEntry = { channelId?: string; handle?: string; key: string };

  const entries: ChannelEntry[] = [];

  // Parse channelIds param: comma-separated UCxxx:handle or UCxxx
  if (channelIdsParam) {
    for (const part of channelIdsParam.split(",")) {
      const [cid, handle] = part.trim().split(":");
      if (cid && cid.startsWith("UC")) {
        entries.push({ channelId: cid, handle: handle || undefined, key: cid });
      }
    }
  }

  // Parse handles (legacy support — no channelId known yet)
  const rawHandles = [
    ...(handlesParam ? handlesParam.split(",") : []),
    ...(inputsParam ? inputsParam.split(",") : []),
  ]
    .map((x) => extractHandle(x))
    .filter((x): x is string => !!x);

  for (const h of Array.from(new Set(rawHandles))) {
    // Don't add if already covered by channelIds
    if (!entries.find((e) => e.handle === h)) {
      entries.push({ handle: h, key: h });
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, results: {} });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || "";

  // Allowlisted 24/7 channels: we run full discovery (including @handle/live fallback) and don't serve stale cache for them
  const ALWAYS_LIVE_HANDLES = new Set(["IRANINTL"]);
  const ALWAYS_LIVE_CHANNEL_IDS = new Set(["UCat6bC0Wrqq9Bcq7EkH_yQw"]);
  const HANDLE_TO_CHANNEL: Record<string, string> = { IRANINTL: "UCat6bC0Wrqq9Bcq7EkH_yQw" };
  for (const e of entries) {
    if (e.handle && !e.channelId && HANDLE_TO_CHANNEL[e.handle]) {
      (e as { channelId?: string }).channelId = HANDLE_TO_CHANNEL[e.handle];
    }
  }
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "youtube/live/route.ts:entries-after-fallback",
      message: "entries after handle->channelId fallback",
      data: { entriesCount: entries.length, withChannelId: entries.filter((e) => e.channelId).length, apiKeySet: !!apiKey },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  const hasAllowlistedChannel = entries.some(
    (e) => (e.handle && ALWAYS_LIVE_HANDLES.has(e.handle)) || (e.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(e.channelId))
  );

  // Shared cache (Redis) first so all serverless instances reuse one result — keeps quota low.
  const cacheKey = getCacheKey(
    entries.filter((e) => e.channelId).map((e) => e.channelId!),
    entries.filter((e) => !e.channelId).map((e) => e.handle!)
  );
  try {
    const raw = await redisGet(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { results: Record<string, Result> };
      if (parsed?.results) {
        return NextResponse.json(
          { ok: true, results: parsed.results, cached: true },
          { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } }
        );
      }
    }
  } catch {
    // Redis miss or error — fall through to in-memory then API
  }
  const cached = liveCache.get(cacheKey);
  const cacheTtlMs = hasAllowlistedChannel ? ALLOWLISTED_CACHE_TTL_MS : LIVE_CACHE_TTL_MS;
  const effectiveTtlMs = cached?.ttlMs ?? cacheTtlMs;
  if (cached && Date.now() - cached.ts < effectiveTtlMs) {
    return NextResponse.json(
      { ok: true, results: cached.results, cached: true },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } }
    );
  }

  // Use only entries that already have channelId (no channels.list here — saves 1 unit per channel).
  // Channel IDs must come from DynamoDB (backfill or admin). Resolving handle→channelId is done in admin only.
  const resolvedEntries: (ChannelEntry & { channelId: string })[] = entries
    .filter((e): e is ChannelEntry & { channelId: string } => !!e.channelId)
    .map((e) => e as ChannelEntry & { channelId: string });

  // Deduplicate by channelId; when duplicate, keep the entry with a handle so result key is handle not raw channelId
  const byChannelId = new Map<string, ChannelEntry & { channelId: string }>();
  for (const e of resolvedEntries) {
    const existing = byChannelId.get(e.channelId);
    if (!existing || e.handle) byChannelId.set(e.channelId, e);
  }
  const resolvedEntriesUnique = Array.from(byChannelId.values());

  // Fetch RSS + Live Redirect for all channels (same 3 fallbacks for every channel so Vercel/datacenter gets IDs when channel/live fails)
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
      if (redirectId && !videoIds.includes(redirectId)) {
        videoIds.push(redirectId);
      }
      return { entry, videoIds, redirectId };
    })
  );

  // Collect all video IDs for a single batch videos.list call (~1 unit total)
  const allVideoIds = Array.from(new Set(discoveryResults.flatMap((r) => r.videoIds)));
  const liveness = apiKey ? await batchCheckLiveness(allVideoIds, apiKey) : [];
  const liveSet = new Set(liveness.filter((v) => v.isLive).map((v) => v.videoId));

  // For allowlisted channels: when discovery (RSS/redirect) didn't find a live video — e.g. on Vercel
  // where fetches often fail — fetch the actual live video ID via search.list so we embed by video ID
  // instead of live_stream?channel= (which shows "Video unavailable").
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
      channelId: d.entry.channelId!,
      videoId: await fetchLiveVideoIdBySearch(d.entry.channelId!, apiKey, {
        lastError: searchLastError,
      }),
    }))
  );
  const liveVideoIdByChannel = new Map<string, string>();
  for (const { channelId, videoId } of searchResults) {
    if (videoId) liveVideoIdByChannel.set(channelId, videoId);
  }
  // #region agent log
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
  // #endregion

  // Build results
  const results: Record<string, Result> = {};

  for (const { entry, videoIds, redirectId } of discoveryResults) {
    const liveFromApi = videoIds.find((id) => liveSet.has(id));
    const key = entry.handle || entry.channelId!;
    const isAlwaysLiveChannel =
      (entry.handle && ALWAYS_LIVE_HANDLES.has(entry.handle)) ||
      (entry.channelId && ALWAYS_LIVE_CHANNEL_IDS.has(entry.channelId));
    const fromSearch = entry.channelId ? liveVideoIdByChannel.get(entry.channelId) : undefined;
    const effectiveVideoId =
      liveFromApi ?? fromSearch ?? (isAlwaysLiveChannel && redirectId ? redirectId : undefined);

    // On Vercel, server-side discovery (RSS/redirect) often fails; for allowlisted 24/7 channels
    // treat as live when we have channelId so the frontend can show the block (embed may still fail).
    const isLive = !!effectiveVideoId || (isAlwaysLiveChannel && !!entry.channelId);
    const channelEmbedUrl = entry.channelId
      ? `https://www.youtube.com/embed/live_stream?channel=${entry.channelId}`
      : undefined;
    // Use actual video ID for watch URL; fallback to channel /live page when we only have allowlist.
    const watchUrl = effectiveVideoId
      ? `https://www.youtube.com/watch?v=${effectiveVideoId}`
      : entry.channelId
        ? `https://www.youtube.com/channel/${entry.channelId}/live`
        : undefined;
    // Only set embedUrl when we have NO video ID (allowlisted fallback). When we have a video ID,
    // frontend must use it: YouTube's /embed/live_stream?channel= often shows "Video unavailable".
    const embedUrl = isLive && channelEmbedUrl && !effectiveVideoId ? channelEmbedUrl : undefined;

    results[key] = {
      channelId: entry.channelId,
      handle: entry.handle,
      isLive,
      videoId: effectiveVideoId,
      watchUrl: isLive ? watchUrl : undefined,
      embedUrl,
      foundBy: effectiveVideoId ? "rss_videos_list" : "none",
    };
    if (key === "IRANINTL" || entry.channelId === "UCat6bC0Wrqq9Bcq7EkH_yQw") {
      // #region agent log
      fetch("http://127.0.0.1:7245/ingest/d5efc3aa-8cbf-4f94-9a4d-8b25d050894c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "youtube/live/route.ts:result-IRANINTL",
          message: "IRANINTL result built",
          data: { key, effectiveVideoId: !!effectiveVideoId, embedUrl: !!embedUrl, isLive },
          timestamp: Date.now(),
          hypothesisId: "C",
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  // Also mark unresolved handles (no channelId found); skip if this channelId is already in results under another key
  for (const entry of Array.from(entries)) {
    const key = entry.handle || entry.channelId!;
    if (results[key]) continue;
    const channelAlreadyInResults =
      entry.channelId && Object.values(results).some((r) => r.channelId === entry.channelId);
    if (channelAlreadyInResults) continue;
    results[key] = {
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

  const ttlSec =
    quotaExceeded
      ? QUOTA_BACKOFF_TTL_SEC
      : hasAllowlistedChannel && results["IRANINTL"]?.videoId
        ? ALLOWLISTED_WITH_VIDEO_TTL_SEC
        : DEFAULT_CACHE_TTL_SEC;
  await redisSet(cacheKey, JSON.stringify({ results }), ttlSec);

  const debugParam = searchParams.get("debug");
  const body: { ok: boolean; results: Record<string, Result>; debug?: object } = { ok: true, results };
  if (debugParam === "1" || debugParam === "true") {
    body.debug = {
      entriesCount: entries.length,
      entriesWithChannelId: entries.filter((e) => e.channelId).length,
      apiKeySet: !!apiKey,
      resolvedCount: resolvedEntriesUnique.length,
      allowlistedNeedingSearchCount: allowlistedNeedingSearch.length,
      searchResultByChannel: Object.fromEntries(liveVideoIdByChannel),
      searchLastError: searchLastError.message ? { channelId: searchLastError.channelId, message: searchLastError.message } : undefined,
      quotaBackoff: quotaExceeded,
      iranintlResult: results["IRANINTL"] ?? results["UCat6bC0Wrqq9Bcq7EkH_yQw"],
    };
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
  });
}