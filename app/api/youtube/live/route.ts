// app/api/youtube/live/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * OPTION 1 (No YouTube Data API at all)
 * -----------------------------------
 * We detect "live" by scraping YouTube HTML pages:
 *   - https://www.youtube.com/@HANDLE/live
 *   - https://www.youtube.com/@HANDLE/streams
 *   - https://www.youtube.com/@HANDLE
 *
 * We extract candidate videoIds and:
 *   - If /live yields ANY videoId => treat it as LIVE and return that watch URL.
 *   - Otherwise, not live.
 *
 * This avoids quota completely.
 */

type FoundBy = "live_page_html" | "live_redirect" | "streams_html" | "home_html" | "none";

type Candidate = {
  videoId: string;
  foundBy: Exclude<FoundBy, "none">;
  sourceUrl: string;
};

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
    const v = url.searchParams.get("v");
    if (v && isValidVideoId(v)) return v;

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
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, finalUrl: res.url || url, text };
}

/** Extract many possible videoIds from YouTube HTML (no matchAll, TS-safe) */
function extractVideoIdsFromHtml(html: string, max = 30): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (id: string) => {
    if (isValidVideoId(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };

  // 1) watch?v=XXXXXXXXXXX
  {
    const re = /watch\?v=([a-zA-Z0-9_-]{11})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      push(m[1]);
      if (out.length >= max) break;
    }
  }

  // 2) "videoId":"XXXXXXXXXXX"
  {
    const re = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      push(m[1]);
      if (out.length >= max) break;
    }
  }

  // 3) canonical watch link
  {
    const re = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const vid = extractVideoIdFromUrl(m[1]);
      if (vid) push(vid);
      if (out.length >= max) break;
    }
  }

  return out;
}

function uniqCandidates(list: Candidate[]) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of list) {
    if (!seen.has(c.videoId)) {
      seen.add(c.videoId);
      out.push(c);
    }
  }
  return out;
}

async function candidatesFromPage(
  url: string,
  foundBy: Candidate["foundBy"],
  max = 25
): Promise<{ candidates: Candidate[]; meta: any; redirectVideoId: string | null }> {
  const res = await fetchHtml(url);
  const ids = extractVideoIdsFromHtml(res.text, max);
  const redirectVid = extractVideoIdFromUrl(res.finalUrl);

  return {
    candidates: ids.map((videoId) => ({
      videoId,
      foundBy,
      sourceUrl: res.finalUrl,
    })),
    meta: { status: res.status, finalUrl: res.finalUrl, extracted: ids.length },
    redirectVideoId: redirectVid,
  };
}

/**
 * Decide "live" without API:
 * - If /live yields a redirect watch?v => live
 * - Else if /live html yields at least one videoId => live, pick first
 * - Else not live
 */
async function resolveLive(handle: string): Promise<Result> {
  const h = normalizeHandle(handle);
  const debug: any = { handle: h };

  const liveUrl = `https://www.youtube.com/@${encodeURIComponent(
    h
  )}/live?hl=en&persist_app=1&app=desktop`;

  const livePage = await candidatesFromPage(liveUrl, "live_page_html", 25);
  debug.livePage = livePage.meta;
  debug.liveRedirect = {
    videoId: livePage.redirectVideoId,
    finalUrl: livePage.meta.finalUrl,
    status: livePage.meta.status,
  };

  // 1) If /live redirected to watch?v=... => live
  if (livePage.redirectVideoId) {
    return {
      handle: h,
      isLive: true,
      videoId: livePage.redirectVideoId,
      watchUrl: `https://www.youtube.com/watch?v=${livePage.redirectVideoId}`,
      foundBy: "live_redirect",
      candidatesChecked: 1,
      debug,
    };
  }

  // 2) If /live HTML contains ANY videoId => treat as live (best effort)
  const liveCandidates = uniqCandidates(livePage.candidates);
  debug.liveCandidatesCount = liveCandidates.length;
  debug.liveCandidatesSample = liveCandidates.slice(0, 8);

  if (liveCandidates.length > 0) {
    const winner = liveCandidates[0];
    return {
      handle: h,
      isLive: true,
      videoId: winner.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${winner.videoId}`,
      foundBy: "live_page_html",
      candidatesChecked: 1,
      debug: { ...debug, winner },
    };
  }

  // Optional fallbacks (NOT used to declare live; just debug help)
  const streamsUrl = `https://www.youtube.com/@${encodeURIComponent(h)}/streams?hl=en`;
  const streamsPage = await candidatesFromPage(streamsUrl, "streams_html", 25);
  debug.streamsPage = streamsPage.meta;

  const homeUrl = `https://www.youtube.com/@${encodeURIComponent(h)}?hl=en`;
  const homePage = await candidatesFromPage(homeUrl, "home_html", 25);
  debug.homePage = homePage.meta;

  const all = uniqCandidates([
    ...streamsPage.candidates,
    ...homePage.candidates,
  ]);
  debug.candidatesTotalFallback = all.length;
  debug.sampleCandidatesFallback = all.slice(0, 8);

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