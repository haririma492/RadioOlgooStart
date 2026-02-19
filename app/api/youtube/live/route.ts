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

function extractVideoIdFromUrl(u: string): string | null {
  try {
    const url = new URL(u);
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    return null;
  } catch {
    return null;
  }
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

async function handleToChannelId(apiKey: string, handle: string): Promise<string | null> {
  const url =
    "https://www.googleapis.com/youtube/v3/channels" +
    `?part=id&forHandle=${encodeURIComponent(handle)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const { ok, json } = await ytApiGet(url);
  if (!ok) return null;

  const id = json?.items?.[0]?.id;
  return typeof id === "string" ? id : null;
}

async function channelIdToLiveVideo(apiKey: string, channelId: string) {
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=id,snippet&channelId=${encodeURIComponent(channelId)}` +
    `&eventType=live&type=video&maxResults=1` +
    `&key=${encodeURIComponent(apiKey)}`;

  const { ok, json } = await ytApiGet(searchUrl);
  if (!ok) return null;

  const item = json?.items?.[0];
  const videoId = item?.id?.videoId;
  const title = item?.snippet?.title;

  if (typeof videoId !== "string" || !videoId) return null;
  return { videoId, title: typeof title === "string" ? title : undefined };
}

/**
 * ✅ Fallback that does NOT depend on YouTube Data API:
 * Fetch https://www.youtube.com/@HANDLE/live
 * If channel is live, YouTube often redirects to https://www.youtube.com/watch?v=VIDEOID
 */
async function liveByRedirect(handle: string) {
  const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/live`;

  const res = await fetch(url, {
    cache: "no-store",
    // Important: realistic headers help YouTube respond consistently
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  // node fetch exposes final url after redirects:
  const finalUrl = res.url || url;

  // If redirected to watch?v=..., extract v:
  const vid = extractVideoIdFromUrl(finalUrl);
  if (vid) return { videoId: vid, method: "redirect" as const, finalUrl };

  // If no redirect, sometimes the HTML still contains a watch link.
  // Try a light regex on HTML (first match only).
  const html = await res.text().catch(() => "");
  const m = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (m?.[1]) {
    return {
      videoId: m[1],
      method: "html_regex" as const,
      finalUrl,
    };
  }

  return { videoId: null as string | null, method: "none" as const, finalUrl };
}

export async function GET(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  const { searchParams } = new URL(req.url);
  const handlesParam = searchParams.get("handles") || "";
  const inputsParam = searchParams.get("inputs") || "";

  const rawList =
    (handlesParam ? handlesParam.split(",") : []).concat(
      inputsParam ? inputsParam.split(",") : []
    );

  const handles = rawList
    .map((x) => extractHandleFromUrlOrHandle(x))
    .filter((x): x is string => !!x);

  const unique = Array.from(new Set(handles));

  const results: Record<
    string,
    {
      handle: string;
      isLive: boolean;
      videoId?: string;
      title?: string;
      channelId?: string;
      source?: "data_api" | "redirect_fallback";
      error?: string;
      debug?: any;
    }
  > = {};

  for (const handle of unique) {
    try {
      // 1) Try YouTube Data API first (if key exists)
      if (apiKey) {
        const channelId = await handleToChannelId(apiKey, handle);
        if (channelId) {
          const live = await channelIdToLiveVideo(apiKey, channelId);
          if (live?.videoId) {
            results[handle] = {
              handle,
              channelId,
              isLive: true,
              videoId: live.videoId,
              title: live.title,
              source: "data_api",
            };
            continue;
          }
          // If API says not live, we still fall back (because API can be wrong)
        } else {
          // even if channelId not found, still try redirect fallback
        }
      }

      // 2) Fallback: /live redirect
      const fb = await liveByRedirect(handle);
      if (fb.videoId) {
        results[handle] = {
          handle,
          isLive: true,
          videoId: fb.videoId,
          source: "redirect_fallback",
          debug: { method: fb.method, finalUrl: fb.finalUrl },
        };
      } else {
        results[handle] = {
          handle,
          isLive: false,
          source: "redirect_fallback",
          debug: { method: fb.method, finalUrl: fb.finalUrl },
        };
      }
    } catch (e: any) {
      results[handle] = {
        handle,
        isLive: false,
        error: e?.message || "unknown_error",
      };
    }
  }

  return NextResponse.json(
    { ok: true, results, debug: { handles: unique } },
    {
      status: 200,
      headers: {
        // absolutely no caching for live detection
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
