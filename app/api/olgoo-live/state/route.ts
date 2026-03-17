import { NextResponse } from "next/server";
import { currentPlayback } from "@/lib/olgoo-live/playback";
import { getSchedule } from "@/lib/olgoo-live/schedules";
import { getPlaylist } from "@/lib/olgoo-live/playlists";
import { resolvePlaybackPosition } from "@/lib/olgoo-live/resolvePlayback";

type OlgooLivePlayerType = "video" | "iframe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

function inferPlayerType(url: string, mediaType?: string, sourceType?: string): OlgooLivePlayerType {
  const lower = (url || "").toLowerCase();
  const media = (mediaType || "").toLowerCase();
  const source = (sourceType || "").toLowerCase();

  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    source.includes("youtube") ||
    media.includes("youtube")
  ) {
    return "iframe";
  }

  return "video";
}

export async function GET() {
  try {
    const state = await currentPlayback();

    let currentItem: {
      title: string;
      url: string;
      durationSec: number;
      mediaType?: string;
      sourceType?: string;
    } | null = null;

    let offsetSec = 0;

    if (state.playState === "playing" && state.sourceScheduleId) {
      const schedule = await getSchedule(state.sourceScheduleId);
      const firstBlock = schedule?.blocks?.[0];

      if (firstBlock?.blockType === "playlist" && firstBlock.refId) {
        const playlist = await getPlaylist(firstBlock.refId);

        if (playlist?.items?.length) {
          const resolved = resolvePlaybackPosition(playlist.items, state.startedAt);
          currentItem = resolved.currentItem;
          offsetSec = resolved.offsetSec;
        }
      }
    }

    const resolvedUrl =
      currentItem?.url ||
      state.mediaUrl ||
      "";

    const playerType = inferPlayerType(
      resolvedUrl,
      currentItem?.mediaType,
      currentItem?.sourceType
    );

    const isConfigured = Boolean(resolvedUrl || state.mediaUrl);
    const isPlaying = state.playState === "playing";
    const canPlay = Boolean(isConfigured && isPlaying && resolvedUrl);
    const playToken = [
      state.playState || "",
      state.sourceScheduleId || "",
      state.sourcePlaylistId || "",
      currentItem?.url || state.mediaUrl || "",
      state.startedAt || "",
      state.updatedAt || "",
    ].join("|");

    return NextResponse.json(
      {
        ok: true,
        playState: state.playState,
        title: currentItem?.title || state.title || "Olgoo Live",
        mediaUrl: resolvedUrl || undefined,
        playerType,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
        sourceScheduleId: state.sourceScheduleId,
        sourcePlaylistId: state.sourcePlaylistId,
        currentItem,
        offsetSec,
        playToken,
        isConfigured,
        configured: isConfigured,
        isLive: canPlay,
        canPlay,
        clickable: canPlay,
        url: resolvedUrl || undefined,
        streamUrl: resolvedUrl || undefined,
        playbackUrl: resolvedUrl || undefined,
        status: canPlay ? "playing" : isConfigured ? "stopped" : "not_configured",
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("GET /api/olgoo-live/state failed", error);
    const message =
      error instanceof Error ? error.message : "Could not read playback state.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        configured: false,
        isConfigured: false,
        isLive: false,
        canPlay: false,
        clickable: false,
        status: "error",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
