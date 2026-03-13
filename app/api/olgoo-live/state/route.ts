import { NextResponse } from "next/server";
import { currentPlayback } from "@/lib/olgoo-live/playback";

export async function GET() {
  try {
    const state = await currentPlayback();

    const mediaUrl = state.mediaUrl || "";
    const isConfigured = Boolean(mediaUrl);
    const isPlaying = state.playState === "playing";

    return NextResponse.json({
      // current backend shape
      playState: state.playState,
      mediaUrl: state.mediaUrl,
      title: state.title,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      sourceScheduleId: state.sourceScheduleId,
      sourcePlaylistId: state.sourcePlaylistId,

      // compatibility aliases for older homepage card logic
      url: mediaUrl || undefined,
      streamUrl: mediaUrl || undefined,
      playbackUrl: mediaUrl || undefined,

      configured: isConfigured,
      isConfigured,
      canPlay: isConfigured && isPlaying,
      clickable: isConfigured && isPlaying,

      status: isConfigured ? (isPlaying ? "playing" : "stopped") : "not_configured",
      statusLabel: isConfigured ? (isPlaying ? "ON AIR" : "READY") : "NOT CONFIGURED",
      message: isConfigured
        ? "Select Olgoo Live to open your branded TV stream."
        : "Olgoo Live is not configured yet.",
    });
  } catch (error) {
    console.error("GET /api/olgoo-live/state failed", error);
    const message =
      error instanceof Error ? error.message : "Could not read playback state.";

    return NextResponse.json(
      {
        error: message,
        configured: false,
        isConfigured: false,
        canPlay: false,
        clickable: false,
        status: "error",
        statusLabel: "HTTP 500",
        message: "Could not read Olgoo Live state.",
      },
      { status: 500 }
    );
  }
}