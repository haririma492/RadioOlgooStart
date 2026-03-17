// app/api/external/status/route.ts
import { NextResponse } from "next/server";

type SourceInput = {
  id: string;
  url: string;
};

type SourceResult = {
  id: string;
  url: string;
  state: "LIVE" | "OFFLINE" | "ERROR";
  reason?: string;
};

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

function log(...args: any[]) {
  console.log("[external-status]", ...args);
}

async function fetchText(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function POST(req: Request) {
  let body: { sources?: SourceInput[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sources = Array.isArray(body.sources) ? body.sources : [];
  if (sources.length === 0) return NextResponse.json({ items: [] as SourceResult[] });

  const batchKey = `batch:${JSON.stringify(sources.map((s) => s.url))}`;
  const cached = getCache<{ items: SourceResult[] }>(batchKey, 15_000);
  if (cached) return NextResponse.json(cached);

  const items: SourceResult[] = [];

  for (const s of sources) {
    try {
      log("INPUT", s);

      const html = await fetchText(s.url);

      // For iranopasmigirim TV page, "ON AIR" + "24/7 Live Broadcast" is the explicit indicator. :contentReference[oaicite:2]{index=2}
      const looksLive =
        html.includes("ON AIR") ||
        html.includes("24/7 Live Broadcast") ||
        html.toLowerCase().includes("on air");

      items.push({
        id: s.id,
        url: s.url,
        state: looksLive ? "LIVE" : "OFFLINE",
        reason: looksLive ? "Indicator text found (ON AIR / 24/7 Live Broadcast)." : "Indicator text not found.",
      });

      log("RESULT", { id: s.id, state: items[items.length - 1].state });
    } catch (e: any) {
      items.push({
        id: s.id,
        url: s.url,
        state: "ERROR",
        reason: String(e?.message ?? e),
      });
      log("ERROR", { id: s.id, message: String(e?.message ?? e) });
    }
  }

  const payload = { items };
  setCache(batchKey, payload);
  return NextResponse.json(payload);
}
