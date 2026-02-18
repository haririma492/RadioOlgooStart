// app/api/youtube/status/route.ts
import { NextResponse } from "next/server";

/**
 * Robust YouTube live detection:
 *  - Accepts @handle URLs, /streams URLs, /channel/UC... URLs, etc.
 *  - Resolves channelId using multiple strategies:
 *      1) Extract /channel/UC... from URL
 *      2) channels.list(forHandle=handle)
 *      3) search.list(type=channel&q=handle)
 *      4) Fetch channel HTML and parse "channelId":"UC...." (server-side fallback)
 *  - Detects live:
 *      search.list(eventType=live&type=video&channelId=...)
 *      then verifies with videos.list(liveStreamingDetails)
 *  - Returns per-channel debug info so you can see failures.
 */

type ChannelInput = {
  id: string;
  url: string;
};

type DebugInfo = {
  steps: string[];
  errors: string[];
  resolvedBy?: string;
  candidateVideoIds?: string[];
};

type ChannelResult = {
  id: string;
  inputUrl: string;
  handle: string | null;
  channelId: string | null;
  state: "LIVE" | "OFFLINE" | "ERROR";
  liveVideoId: string | null;
  watchUrl: string | null;
  embedUrl: string | null;
  reason?: string;
  debug?: DebugInfo;
};

// Small in-memory cache to reduce quota burn when UI polls
type CacheEntry = { at: number; value: any };
const cache = new Map<string, CacheEntry>();

function getCache<T>(key: string, ttlMs: number): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}
function setCache(key: string, value: any) {
  cache.set(key, { at: Date.now(), value });
}

function normalizeUrl(u: string): string {
  const s = (u ?? "").trim();
  if (!s) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

function extractHandle(s: string): string | null {
  const m = s.match(/@([A-Za-z0-9._-]+)/);
  return m ? m[1] : null;
}

function extractChannelId(s: string): string | null {
  const m = s.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractVideoIdFromWatchUrl(input: string): string | null {
  const s = normalizeUrl(input);

  const m1 = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (m1) return m1[1];

  const m2 = s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (m2) return m2[1];

  const m3 = s.match(/\/live\/([A-Za-z0-9_-]{6,})/);
  if (m3) return m3[1];

  return null;
}

async function fetchJson(url: string, debug: DebugInfo) {
  debug.steps.push(`fetchJson: ${url}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} (${text.slice(0, 160)})`);
  }
  return res.json();
}

async function fetchText(url: string, debug: DebugInfo) {
  debug.steps.push(`fetchText: ${url}`);
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Helps get consistent HTML
      "User-Agent":
        "Mozilla/5.0 (compatible; OlgooLiveChecker/1.0; +https://olgoo.com)",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} (${text.slice(0, 160)})`);
  }
  return res.text();
}

async function resolveChannelId(
  inputUrl: string,
  apiKey: string,
  debug: DebugInfo
): Promise<{ handle: string | null; channelId: string | null }> {
  // 1) Direct /channel/UC...
  const direct = extractChannelId(inputUrl);
  if (direct) {
    debug.resolvedBy = "extractChannelIdFromUrl";
    return { handle: extractHandle(inputUrl), channelId: direct };
  }

  const handle = extractHandle(inputUrl);
  const handleOrGuess = handle || inputUrl.replace(/^https?:\/\/(www\.)?youtube\.com\//, "").replace(/^@/, "");
  const cleaned = handleOrGuess?.trim() || null;

  // 2) channels.list(forHandle=)
  if (cleaned && !cleaned.includes("/")) {
    try {
      const url =
        "https://www.googleapis.com/youtube/v3/channels" +
        `?part=id&forHandle=${encodeURIComponent(cleaned)}` +
        `&key=${encodeURIComponent(apiKey)}`;
      const data = await fetchJson(url, debug);
      const id = data?.items?.[0]?.id;
      if (typeof id === "string" && id.startsWith("UC")) {
        debug.resolvedBy = "channels.list(forHandle)";
        return { handle: cleaned, channelId: id };
      }
    } catch (e: any) {
      debug.errors.push(`channels.list(forHandle) failed: ${String(e?.message ?? e)}`);
    }
  }

  // 3) search.list(type=channel&q=handle)
  if (cleaned) {
    try {
      const q = cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
      const url =
        "https://www.googleapis.com/youtube/v3/search" +
        `?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(q)}` +
        `&key=${encodeURIComponent(apiKey)}`;
      const data = await fetchJson(url, debug);
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const it of items) {
        const cid = it?.snippet?.channelId;
        if (typeof cid === "string" && cid.startsWith("UC")) {
          debug.resolvedBy = "search.list(type=channel&q=@handle)";
          return { handle: cleaned, channelId: cid };
        }
      }
    } catch (e: any) {
      debug.errors.push(`search.list(type=channel) failed: ${String(e?.message ?? e)}`);
    }
  }

  // 4) HTML fallback: fetch https://www.youtube.com/@handle and parse "channelId":"UC..."
  if (cleaned) {
    try {
      const pageUrl = `https://www.youtube.com/@${encodeURIComponent(cleaned.replace(/^@/, ""))}`;
      const html = await fetchText(pageUrl, debug);

      // Common patterns in YouTube HTML
      const m =
        html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) ||
        html.match(/externalId":"(UC[a-zA-Z0-9_-]+)"/);

      if (m && m[1]) {
        debug.resolvedBy = "htmlParse(channelId)";
        return { handle: cleaned, channelId: m[1] };
      }

      debug.errors.push("HTML fetched but channelId not found in page source.");
    } catch (e: any) {
      debug.errors.push(`html fallback failed: ${String(e?.message ?? e)}`);
    }
  }

  return { handle: handle ?? null, channelId: null };
}

async function searchLiveCandidates(channelId: string, apiKey: string, debug: DebugInfo): Promise<string[]> {
  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=id&channelId=${encodeURIComponent(channelId)}` +
    `&eventType=live&type=video&maxResults=5&order=date` +
    `&key=${encodeURIComponent(apiKey)}`;

  const data = await fetchJson(url, debug);
  const items = Array.isArray(data?.items) ? data.items : [];
  const ids: string[] = [];
  for (const it of items) {
    const vid = it?.id?.videoId;
    if (typeof vid === "string") ids.push(vid);
  }
  debug.candidateVideoIds = ids;
  return ids;
}

async function verifyTrulyLive(videoIds: string[], apiKey: string, debug: DebugInfo): Promise<string | null> {
  if (videoIds.length === 0) return null;

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=liveStreamingDetails,status&id=${encodeURIComponent(videoIds.join(","))}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const data = await fetchJson(url, debug);
  const items = Array.isArray(data?.items) ? data.items : [];

  let best: { id: string; startedAt: number } | null = null;

  for (const it of items) {
    const id = it?.id;
    if (typeof id !== "string") continue;

    const lsd = it?.liveStreamingDetails;
    const actualStart = lsd?.actualStartTime ? Date.parse(lsd.actualStartTime) : NaN;
    const actualEnd = lsd?.actualEndTime ? Date.parse(lsd.actualEndTime) : NaN;

    const hasStarted = Number.isFinite(actualStart);
    const hasEnded = Number.isFinite(actualEnd);

    if (hasStarted && !hasEnded) {
      if (!best || actualStart > best.startedAt) best = { id, startedAt: actualStart };
    }
  }

  return best?.id ?? null;
}

export async function POST(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY. Add it to .env.local (local) and Vercel env vars." },
      { status: 500 }
    );
  }

  let body: { channels?: ChannelInput[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channels = Array.isArray(body.channels) ? body.channels : [];
  if (channels.length === 0) return NextResponse.json({ items: [] as ChannelResult[] });

  // Cache per requested list for 15s
  const batchKey = `batch:${JSON.stringify(channels.map((c) => c.url))}`;
  const cached = getCache<{ items: ChannelResult[] }>(batchKey, 15_000);
  if (cached) return NextResponse.json(cached);

  const items: ChannelResult[] = [];

  for (const ch of channels) {
    const debug: DebugInfo = { steps: [], errors: [] };

    const inputUrl = normalizeUrl(ch.url);

    try {
      // If a watch URL is passed, we can verify it, but we still want channel-based detection.
      const directVideoId = extractVideoIdFromWatchUrl(inputUrl);
      if (directVideoId) debug.steps.push(`watchUrlVideoIdDetected: ${directVideoId}`);

      const { handle, channelId } = await resolveChannelId(inputUrl, apiKey, debug);

      if (!channelId) {
        items.push({
          id: ch.id,
          inputUrl,
          handle,
          channelId: null,
          state: "ERROR",
          liveVideoId: null,
          watchUrl: null,
          embedUrl: null,
          reason: "Could not resolve channelId (see debug).",
          debug,
        });
        continue;
      }

      const candidates = await searchLiveCandidates(channelId, apiKey, debug);
      const trulyLiveId = await verifyTrulyLive(candidates, apiKey, debug);

      if (trulyLiveId) {
        items.push({
          id: ch.id,
          inputUrl,
          handle,
          channelId,
          state: "LIVE",
          liveVideoId: trulyLiveId,
          watchUrl: `https://www.youtube.com/watch?v=${trulyLiveId}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${trulyLiveId}`,
          debug,
        });
      } else {
        items.push({
          id: ch.id,
          inputUrl,
          handle,
          channelId,
          state: "OFFLINE",
          liveVideoId: null,
          watchUrl: null,
          embedUrl: null,
          debug,
        });
      }
    } catch (e: any) {
      debug.errors.push(String(e?.message ?? e));
      items.push({
        id: ch.id,
        inputUrl,
        handle: extractHandle(inputUrl),
        channelId: extractChannelId(inputUrl),
        state: "ERROR",
        liveVideoId: null,
        watchUrl: null,
        embedUrl: null,
        reason: "Request failed (see debug).",
        debug,
      });
    }
  }

  const payload = { items };
  setCache(batchKey, payload);
  return NextResponse.json(payload);
}
