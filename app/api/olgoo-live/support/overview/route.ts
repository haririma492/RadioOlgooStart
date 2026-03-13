import { NextResponse } from "next/server";
import { listSavedPlaylists } from "@/lib/olgoo-live/playlists";
import { listSavedSchedules } from "@/lib/olgoo-live/schedules";
import { listSavedSubtitleSets } from "@/lib/olgoo-live/subtitles";
import { fetchChannelState } from "@/lib/olgoo-live/schedules";

export async function GET() {
  try {
    const [playlists, schedules, subtitles, channelState] = await Promise.all([
      listSavedPlaylists(),
      listSavedSchedules(),
      listSavedSubtitleSets(),
      fetchChannelState("OLGOO_LIVE"),
    ]);

    return NextResponse.json({
      ok: true,
      playlists: playlists.length,
      schedules: schedules.length,
      subtitleSets: subtitles.length,
      activeScheduleId: channelState?.activeScheduleId || null,
    });
  } catch (error) {
    console.error("olgoo-live support overview failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load support overview." },
      { status: 500 }
    );
  }
}
