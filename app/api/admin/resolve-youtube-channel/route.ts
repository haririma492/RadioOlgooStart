// app/api/admin/resolve-youtube-channel/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function requireAdmin(req: Request) {
    const token = req.headers.get("x-admin-token") || "";
    if (!ADMIN_TOKEN) return { ok: false, error: "Server missing ADMIN_TOKEN env var." };
    if (token !== ADMIN_TOKEN) return { ok: false, error: "Invalid admin token." };
    return { ok: true };
}

function extractHandle(input: string): string | null {
    const s = (input || "").trim();
    // @handle or bare handle
    if (/^@?[A-Za-z0-9._-]+$/.test(s)) return s.replace(/^@/, "");
    // youtube.com/@handle
    const m1 = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
    if (m1?.[1]) return m1[1];
    // youtube.com/c/name or youtube.com/user/name
    const m2 = s.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9._-]+)/i);
    if (m2?.[1]) return m2[1];
    return null;
}

/**
 * POST /api/admin/resolve-youtube-channel
 * Body: { url: string }
 * Returns: { channelId: string | null, handle: string | null }
 *
 * Uses channels.list API (1 quota unit) — safe to call once on admin save.
 */
export async function POST(req: Request) {
    const auth = requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

    const apiKey = process.env.YOUTUBE_API_KEY || "";
    if (!apiKey) {
        return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });
    }

    let body: { url?: string } = {};
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const url = (body.url || "").trim();
    if (!url) {
        return NextResponse.json({ channelId: null, handle: null, error: "url is required" });
    }

    // If the URL directly contains a channelId (UC...)
    const directMatch = url.match(/\/channel\/(UC[A-Za-z0-9_-]+)/i);
    if (directMatch?.[1]) {
        return NextResponse.json({ channelId: directMatch[1], handle: null, resolvedBy: "direct_url" });
    }

    const handle = extractHandle(url);
    if (!handle) {
        return NextResponse.json({ channelId: null, handle: null, error: "Could not extract handle from URL" });
    }

    try {
        const apiUrl =
            `https://www.googleapis.com/youtube/v3/channels` +
            `?part=id&forHandle=${encodeURIComponent("@" + handle)}` +
            `&key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(apiUrl, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
            const msg = json?.error?.message || `YouTube API HTTP ${res.status}`;
            return NextResponse.json({ channelId: null, handle, error: msg }, { status: 502 });
        }

        const channelId = json?.items?.[0]?.id;
        if (typeof channelId === "string" && channelId.startsWith("UC")) {
            return NextResponse.json({ channelId, handle, resolvedBy: "channels.list" });
        }

        return NextResponse.json({ channelId: null, handle, error: "Channel not found via API" });
    } catch (e: any) {
        return NextResponse.json({ channelId: null, handle, error: e?.message || "fetch_failed" }, { status: 500 });
    }
}
