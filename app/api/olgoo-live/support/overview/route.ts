import { NextResponse } from "next/server";
import { listPlaylists } from "@/lib/olgoo-live/playlists";
import { listSchedules } from "@/lib/olgoo-live/schedules";
import { listSavedSubtitleSets } from "@/lib/olgoo-live/subtitles";
import { getPlaybackState } from "@/lib/olgoo-live/dynamo";

export async function GET() {
  try {
    const [playlists, schedules, subtitles, playbackState] = await Promise.all([
      listPlaylists(),
      listSchedules(),
      listSavedSubtitleSets(),
      getPlaybackState(),
    ]);

    return NextResponse.json({
      ok: true,
      playlists: playlists.length,
      schedules: schedules.length,
      subtitleSets: subtitles.length,
      activeScheduleId: playbackState?.sourceScheduleId || null,
    });
  } catch (error) {
    console.error("olgoo-live support overview failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load support overview." },
      { status: 500 }
    );
  }
}