import { NextResponse } from "next/server";
import {
  startPlayback,
  startPlaybackFromSchedule,
  stopPlayback,
} from "@/lib/olgoo-live/playback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, mediaUrl, title, scheduleId } = body || {};

    if (action === "start") {
      if (typeof scheduleId === "string" && scheduleId.trim()) {
        const state = await startPlaybackFromSchedule(scheduleId.trim());
        return NextResponse.json({
          ok: true,
          message: `Activated schedule "${scheduleId}".`,
          state,
        });
      }

      if (typeof mediaUrl === "string" && mediaUrl.trim()) {
        const state = await startPlayback(mediaUrl.trim(), title || "Olgoo Live");
        return NextResponse.json({
          ok: true,
          message: "Started direct playback.",
          state,
        });
      }

      return NextResponse.json(
        { error: "Start requires either scheduleId or mediaUrl." },
        { status: 400 }
      );
    }

    if (action === "stop") {
      const state = await stopPlayback();
      return NextResponse.json({
        ok: true,
        message: "Playback stopped.",
        state,
      });
    }

    if (action === "refresh") {
      return NextResponse.json({
        ok: true,
        message: "Refresh acknowledged.",
      });
    }

    return NextResponse.json(
      { error: "Unsupported action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/olgoo-live/control failed", error);
    const message =
      error instanceof Error ? error.message : "Control request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
