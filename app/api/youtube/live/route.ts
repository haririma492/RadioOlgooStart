import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeHandle(h: string) {
  return h.trim().replace(/^@/, "").toLowerCase();
}

function extractHandleFromUrlOrHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);

  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return normalizeHandle(m[1]);

  return null;
}

async function ytApiGet(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const text = await res.text().catch(() => "");
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text?.slice(0, 800) };
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Robust handle -> channelId:
 * search channels by "@handle" (works when channels.list forHandle fails)
 */
async function handleToChannelId(apiKey: string, handle: string): Promise<string | null> {
  // 1) Try search by "@handle"
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=id,snippet&type=channel&maxResults=5` +
    `&q=${encodeURIComponent("@" + handle)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const s1 = await ytApiGet(searchUrl);
  if (s1.ok) {
    const items: any[] = Array.isArray(s1.json?.items) ? s1.json.items : [];
    // pick exact match if possible
    const exact = items.find(
      (it) =>
        normalizeHandle(it?.snippet?.channelTitle || "") === normalizeHandle(handle) ||
        normalizeHandle(it?.snippet?.title || "") === normalizeHandle(handle)
    );
    const best = exact || items[0];
    const cid = best?.id?.channelId;
    if (typeof cid === "string" && cid) return cid;
  }

  // 2) Fallback: channels.list?forUsername (legacy; rarely works)
  const legacyUrl =
    "https://www.googleapis.com/youtube/v3/channels" +
    `?part=id&forUsername=${encodeURIComponent(handle)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const s2 = await ytApiGet(legacyUrl);
  const id2 = s2.json?.items?.[0]?.id;
  if (typeof id2 === "string" && id2) return id2;

  return null;
}

async function channelIdToCandidateLiveVideo(apiKey: string, channelId: string) {
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=id,snippet&channelId=${encodeURIComponent(channelId)}` +
    `&eventType=live&type=video&maxResults=5` +
    `&key=${encodeURIComponent(apiKey)}`;

  const { ok, json } = await ytApiGet(searchUrl);
  if (!ok) return null;

  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  for (const it of items) {
    const videoId = it?.id?.videoId;
    const title = it?.snippet?.title;
    if (typeof videoId === "string" && videoId) {
      return {
        videoId,
        title: typeof title === "string" ? title : undefined,
        method: "search_eventType_live",
      };
    }
  }
  return null;
}

async function verifyVideoIsLive(apiKey: string, videoId: string) {
  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=snippet,liveStreamingDetails&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const { ok, json } = await ytApiGet(url);
  if (!ok) return { ok: false, isLive: false, reason: "videos_list_failed", raw: json };

  const item = json?.items?.[0];
  if (!item) return { ok: true, isLive: false, reason: "no_video_item" };

  const liveBroadcastContent = item?.snippet?.liveBroadcastContent; // live|upcoming|none
  const lsd = item?.liveStreamingDetails;

  const hasActualStart = typeof lsd?.actualStartTime === "string" && lsd.actualStartTime.length > 0;
  const hasActualEnd = typeof lsd?.actualEndTime === "string" && lsd.actualEndTime.length > 0;

  const isLive =
    liveBroadcastContent === "live" ||
    (hasActualStart && !hasActualEnd);

  return {
    ok: true,
    isLive,
    reason: isLive ? "verified_live" : `not_live:${String(liveBroadcastContent || "unknown")}`,
  };
}

export async function GET(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing env var YOUTUBE_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";

  const rawList =
    (handlesParam ? handlesParam.split(",") : []).concat(inputsParam ? inputsParam.split(",") : []);

  const handles = rawList
    .map((x) => extractHandleFromUrlOrHandle(x))
    .filter((x): x is string => !!x);

  const unique = Array.from(new Set(handles));

  const results: Record<
    string,
    { handle: string; isLive: boolean; videoId?: string; title?: string; error?: string; debug?: any }
  > = {};

  for (const handle of unique) {
    try {
      const channelId = await handleToChannelId(apiKey, handle);

      if (!channelId) {
        results[handle] = { handle, isLive: false, error: "channelId_not_found" };
        continue;
      }

      const candidate = await channelIdToCandidateLiveVideo(apiKey, channelId);
      if (!candidate) {
        results[handle] = { handle, isLive: false, debug: { channelId, note: "no live items" } };
        continue;
      }

      const v = await verifyVideoIsLive(apiKey, candidate.videoId);

      if (!v.ok) {
        results[handle] = { handle, isLive: false, error: v.reason, debug: { channelId, candidate, verify: v } };
        continue;
      }

      if (!v.isLive) {
        results[handle] = { handle, isLive: false, debug: { channelId, candidate, verify: v } };
        continue;
      }

      results[handle] = {
        handle,
        isLive: true,
        videoId: candidate.videoId,
        title: candidate.title,
        debug: { channelId, pickedBy: candidate.method, verify: v.reason },
      };
    } catch (e: any) {
      results[handle] = { handle, isLive: false, error: e?.message || "unknown_error" };
    }
  }

  return NextResponse.json({ ok: true, results, debug: { handles: unique } }, { status: 200 });
}
