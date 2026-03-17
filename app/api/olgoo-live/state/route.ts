import { NextResponse } from "next/server";
import { currentPlayback, resolveCanonicalPlayback } from "@/lib/olgoo-live/playback";
import type { CanonicalLiveState, OlgooLivePlayerType } from "@/lib/olgoo-live/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

function inferPlayerType(url: string): OlgooLivePlayerType {
  const lower = (url || "").toLowerCase();
  if (/youtube\.com|youtu\.be/.test(lower)) return "iframe";
  if (/\.(mp3|wav|m4a|aac|ogg)(\?|$)/.test(lower)) return "audio";
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(lower)) return "image";
  return "video";
}

function withVersionToken(url?: string, token?: string): string | undefined {
  if (!url) return undefined;
  if (!token) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("broadcast", token);
    return parsed.toString();
  } catch {
    const glue = url.includes("?") ? "&" : "?";
    return `${url}${glue}broadcast=${encodeURIComponent(token)}`;
  }
}

export async function GET() {
  try {
    const playbackState = await currentPlayback();
    const resolved = await resolveCanonicalPlayback(playbackState);
    const versionToken = playbackState.startedAt || playbackState.updatedAt || "static";

    const currentItem = resolved.currentItem
      ? {
          ...resolved.currentItem,
          url: withVersionToken(resolved.currentItem.url, versionToken) || resolved.currentItem.url,
          versionToken,
        }
      : null;

    const mediaUrl = withVersionToken(currentItem?.url || playbackState.mediaUrl, versionToken);
    const configured = Boolean(mediaUrl);
    const canPlay = configured && playbackState.playState === "playing";
    const title = currentItem?.title || playbackState.title || "Olgoo Live";
    const playerType = inferPlayerType(mediaUrl || "");

    const body: CanonicalLiveState = {
      ok: true,
      configured,
      canPlay,
      isLive: canPlay,
      playState: playbackState.playState,
      serverNow: new Date().toISOString(),
      startedAt: playbackState.startedAt,
      updatedAt: playbackState.updatedAt,
      sourceScheduleId: playbackState.sourceScheduleId,
      sourcePlaylistId: playbackState.sourcePlaylistId,
      title,
      mediaUrl,
      playerType,
      offsetSec: resolved.offsetSec,
      currentItem,
      message: canPlay
        ? "Canonical live state ready. Clients should mute, close, or resync only."
        : configured
          ? "Olgoo Live is configured but not currently playing."
          : "Olgoo Live is not configured yet.",
      cachePolicy: "no-store",
      versionToken,
    };

    return NextResponse.json(body, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve canonical live state.";

    return NextResponse.json(
      {
        ok: false,
        configured: false,
        canPlay: false,
        isLive: false,
        playState: "stopped",
        serverNow: new Date().toISOString(),
        offsetSec: 0,
        message,
        cachePolicy: "no-store",
      } satisfies CanonicalLiveState,
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
