import { NextResponse } from "next/server";
import { resolveNowPlaying } from "@/lib/olgoo-live/live";

export async function GET() {
  try {
    const data = await resolveNowPlaying("OLGOO_LIVE");
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error("olgoo-live live status failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load live status." },
      { status: 500 }
    );
  }
}
