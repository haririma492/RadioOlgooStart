import { NextRequest, NextResponse } from "next/server";
import {
  getPlaylist,
  listPlaylists,
  savePlaylist,
} from "@/lib/olgoo-live/playlists";
import type { PlaylistItem } from "@/lib/olgoo-live/types";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const playlistId = request.nextUrl.searchParams.get("playlistId");

    if (playlistId) {
      const playlist = await getPlaylist(playlistId);
      if (!playlist) {
        return bad("Playlist not found.", 404);
      }
      return NextResponse.json({ playlist });
    }

    const playlists = await listPlaylists();
    return NextResponse.json({ playlists });
  } catch (error) {
    console.error("GET /api/olgoo-live/playlists failed", error);
    const message =
      error instanceof Error ? error.message : "Could not load playlists.";
    return bad(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name) {
      return bad("Playlist name is required.");
    }

    if (!items.length) {
      return bad("At least one playlist item is required.");
    }

    const normalizedItems: PlaylistItem[] = items.map(
      (item: unknown, index: number) => {
        const row = (item || {}) as Record<string, unknown>;
        return {
          assetPk: row.assetPk ? String(row.assetPk) : undefined,
          title: String(row.title || `Item ${index + 1}`).trim(),
          url: String(row.url || "").trim(),
          durationSec: Number(row.durationSec || 0),
        };
      }
    );

    if (normalizedItems.some((item) => !item.url || item.durationSec <= 0)) {
      return bad("Each playlist item must have a URL and durationSec > 0.");
    }

    const playlist = await savePlaylist({
      name,
      items: normalizedItems,
    });

    return NextResponse.json({
      ok: true,
      playlist,
      message: "Playlist saved.",
    });
  } catch (error) {
    console.error("POST /api/olgoo-live/playlists failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save playlist.";
    return bad(message, 500);
  }
}
