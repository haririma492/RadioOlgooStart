// app/api/youtube/status/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChannelInput = { id: string; url: string };

type DebugInfo = {
  steps: string[];
  errors: string[];
  resolvedBy?: string;
  candidateVideoIds?: string[];
  htmlFallback?: {
    tried: boolean;
    foundVideoId?: string | null;
  };
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

// ---- cache ----
type CacheEntry = { at: number; value: any };
const batchCache = new Map<string, CacheEntry>();

type LastLive = {
  at: number;
  liveVideoId: string;
  watchUrl: string;
  embedUrl: string;
  channelId: string | null;
};
const lastLiveById = new Map<string, LastLive>();

function getCache<T>(m: Map<string, CacheEntry>, key: string, ttlMs: number): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) {
    m.delete(key);
    return null;
  }
  return e.value as T;
}
function setCache(m: Map<string, CacheEntry>, key: string, value: any) {
  m.set(key, { at: Date.now(), value });
}

// ---- helpers ----
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
      "User-Agent": "Mozilla/5.0 (compatible; OlgooLiveChecker/1.0)",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} (${text.slice(0, 160)})`);
  }
  return res.text();
}

// ✅ HTML fallback: try https://www.youtube.com/@handle/live and extract watch?v=
async function htmlFallbackFindLiveVideoId(handle: string, debug: DebugInfo): Promise<string | null> {
  debug.htmlFallback = { tried: true, foundVideoId: null };
  try {
    const h = handle.replace(/^@/, "");
    const liveUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/live`;
    const html = await fetchText(liveUrl, debug);

    // Look for watch?v=VIDEOID occurrences
    // YouTube pages usually include several; we pick the first plausible.
    const matches = Array.from(html.matchAll(/watch\?v=([A-Za-z0-9_-]{11})/g)).map((m) => m[1]);
    const vid = matches?.[0] || null;

    debug.htmlFallback.foundVideoId = vid;

    return vid;
  } catch (e: any) {
    debug.errors.push(`html /live fallback failed: ${String(e?.message ?? e)}`);
    return null;
  }
}

async function resolveChannelId(inputUrl: string, apiKey: string, debug: DebugInfo) {
  const direct = extractChannelId(inputUrl);
  if (direct) {
    debug.resolvedBy = "extractChannelIdFromUrl";
    return { handle: extractHandle(inputUrl), channelId: direct };
  }

  const handle = extractHandle(inputUrl);
  const cleaned = handle?.trim() || null;

  // channels.list(forHandle=)
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

  // search.list(type=channel&q=@handle)
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
          debug.resolvedBy = "search.list(type=channel)";
          return { handle: cleaned, channelId: cid };
        }
      }
    } catch (e: any) {
      debug.errors.push(`search.list(type=channel) failed: ${String(e?.message ?? e)}`);
    }
  }

  // HTML parse channelId from @handle page
  if (cleaned) {
    try {
      const pageUrl = `https://www.youtube.com/@${encodeURIComponent(cleaned.replace(/^@/, ""))}`;
      const html = await fetchText(pageUrl, debug);
      const m =
        html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) ||
        html.match(/externalId":"(UC[a-zA-Z0-9_-]+)"/);
      if (m && m[1]) {
        debug.resolvedBy = "htmlParse(channelId)";
        return { handle: cleaned, channelId: m[1] };
      }
      debug.errors.push("HTML fetched but channelId not found.");
    } catch (e: any) {
      debug.errors.push(`html channelId fallback failed: ${String(e?.message ?? e)}`);
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
  if (!apiKey) return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });

  let body: { channels?: ChannelInput[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channels = Array.isArray(body.channels) ? body.channels : [];
  if (channels.length === 0) return NextResponse.json({ items: [] as ChannelResult[] });

  const batchKey = `batch:${JSON.stringify(channels.map((c) => c.url))}`;
  const cached = getCache<{ items: ChannelResult[] }>(batchCache, batchKey, 15_000);
  if (cached) return NextResponse.json(cached);

  const items: ChannelResult[] = [];

  for (const ch of channels) {
    const debug: DebugInfo = { steps: [], errors: [] };
    const inputUrl = normalizeUrl(ch.url);

    try {
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
          reason: "Could not resolve channelId.",
          debug,
        });
        continue;
      }

      const candidates = await searchLiveCandidates(channelId, apiKey, debug);
      let trulyLiveId = await verifyTrulyLive(candidates, apiKey, debug);

      // ✅ NEW: if API says offline, try HTML /@handle/live fallback
      if (!trulyLiveId && handle) {
        const fallbackId = await htmlFallbackFindLiveVideoId(handle, debug);
        if (fallbackId) {
          trulyLiveId = fallbackId;
          debug.steps.push("LIVE overridden by HTML /@handle/live fallback");
        }
      }

      if (trulyLiveId) {
        const watchUrl = `https://www.youtube.com/watch?v=${trulyLiveId}`;
        const embedUrl = `https://www.youtube-nocookie.com/embed/${trulyLiveId}`;

        lastLiveById.set(ch.id, { at: Date.now(), liveVideoId: trulyLiveId, watchUrl, embedUrl, channelId });

        items.push({
          id: ch.id,
          inputUrl,
          handle,
          channelId,
          state: "LIVE",
          liveVideoId: trulyLiveId,
          watchUrl,
          embedUrl,
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

      const last = lastLiveById.get(ch.id);
      const graceMs = 120_000;

      if (last && Date.now() - last.at <= graceMs) {
        items.push({
          id: ch.id,
          inputUrl,
          handle: extractHandle(inputUrl),
          channelId: last.channelId,
          state: "LIVE",
          liveVideoId: last.liveVideoId,
          watchUrl: last.watchUrl,
          embedUrl: last.embedUrl,
          reason: "Using last-known LIVE (temporary API error).",
          debug,
        });
      } else {
        items.push({
          id: ch.id,
          inputUrl,
          handle: extractHandle(inputUrl),
          channelId: extractChannelId(inputUrl),
          state: "ERROR",
          liveVideoId: null,
          watchUrl: null,
          embedUrl: null,
          reason: "Request failed.",
          debug,
        });
      }
    }
  }

  const payload = { items };
  setCache(batchCache, batchKey, payload);
  return NextResponse.json(payload);
}
