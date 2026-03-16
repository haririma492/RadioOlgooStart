import { NextRequest, NextResponse } from "next/server";
import { getPlaylist } from "@/lib/olgoo-live/playlists";
import { listSchedules, saveSchedule } from "@/lib/olgoo-live/schedules";
import type { ScheduleBlock } from "@/lib/olgoo-live/types";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: NextRequest) {
  try {
    const schedules = await listSchedules();
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("GET /api/olgoo-live/schedules failed", error);
    const message =
      error instanceof Error ? error.message : "Could not load schedules.";
    return bad(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body?.name || "").trim();
    const playlistId = String(body?.playlistId || "").trim();
    const channelId = String(body?.channelId || "OLGOO_LIVE").trim();

    if (!name) {
      return bad("Schedule name is required.");
    }

    if (!playlistId) {
      return bad("playlistId is required.");
    }

    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return bad(`Playlist not found: ${playlistId}`, 404);
    }

    if (!playlist.items || playlist.items.length === 0) {
      return bad(`Playlist "${playlistId}" has no items.`, 400);
    }

    const blocks: ScheduleBlock[] = [
      {
        order: 1,
        blockType: "playlist",
        refId: playlist.playlistId,
        title: playlist.name,
        durationSec: Number(playlist.totalDurationSec || 0),
      },
    ];

    const schedule = await saveSchedule({
      name,
      channelId,
      blocks,
    });

    return NextResponse.json({
      ok: true,
      schedule,
      message: "Schedule saved.",
    });
  } catch (error) {
    console.error("POST /api/olgoo-live/schedules failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save schedule.";
    return bad(message, 500);
  }
}