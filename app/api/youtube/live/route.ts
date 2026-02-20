// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * STRICT MODE (Redirect-only)
 * --------------------------
 * We detect "LIVE NOW" ONLY if:
 *   https://www.youtube.com/@HANDLE/live
 * redirects to:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *
 * This eliminates most false-positives where /live HTML contains video IDs
 * (recorded videos, premieres, past streams, channel modules, etc.)
 *
 * Tradeoff:
 * - Very low false positives
 * - Potentially higher false negatives in rare cases where YouTube doesn't redirect
 */

type FoundBy = "live_redirect" | "none";

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

function normalizeHandle(h: string) {
  return (h || "").trim().replace(/^@/, "");
}

function extractHandleFromUrlOrHandle(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  // direct handle e.g. "IRANINTL" or "@IRANINTL"
  if (/^@?[A-Za-z0-9._-]+$/.test(s)) return normalizeHandle(s);

  // youtube handle URL: https://www.youtube.com/@IRANINTL or /@IRANINTL/streams
  const m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (m?.[1]) return normalizeHandle(m[1]);

  return null;
}

function isValidVideoId(v: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(v);
}

function extractVideoIdFromUrl(u: string): string | null {
  try {
    const url = new URL(u);

    // watch?v=XXXXXXXXXXX
    const v = url.searchParams.get("v");
    if (v && isValidVideoId(v)) return v;

    // youtu.be/XXXXXXXXXXX
    if (/youtu\.be$/i.test(url.hostname)) {
      const id = url.pathname.replace("/", "");
      if (isValidVideoId(id)) return id;
    }

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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // We still read the text for debugging if needed,
  // but in strict mode we only use the FINAL URL redirect signal.
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, finalUrl: res.url || url, text };
}

/**
 * Strict "LIVE NOW" decision:
 * - If /live redirects to watch?v=... => LIVE NOW
 * - Else => NOT LIVE
 */
async function resolveLive(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h };

  const liveUrl = `https://www.youtube.com/@${encodeURIComponent(
    h
  )}/live?hl=en&persist_app=1&app=desktop`;

  const res = await fetchHtml(liveUrl);

  debug.live = {
    status: res.status,
    finalUrl: res.finalUrl,
    ok: res.ok,
  };

  const redirectedVideoId = extractVideoIdFromUrl(res.finalUrl);

  if (redirectedVideoId) {
    return {
      handle: h,
      isLive: true,
      videoId: redirectedVideoId,
      watchUrl: `https://www.youtube.com/watch?v=${redirectedVideoId}`,
      foundBy: "live_redirect",
      candidatesChecked: 1,
      debug,
    };
  }

  return {
    handle: h,
    isLive: false,
    foundBy: "none",
    candidatesChecked: 0,
    debug,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // /api/youtube/live?handles=IRANINTL,gghamarimpp,manototv
  // OR /api/youtube/live?inputs=https://www.youtube.com/@IRANINTL/streams,@manototv
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