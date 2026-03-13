import { NextResponse } from "next/server";
import { listSlides } from "@/lib/olgoo-live/slides";

export async function GET() {
  try {
    const items = await listSlides(500);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("olgoo-live slides failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load RadioOlgooSlides items." },
      { status: 500 }
    );
  }
}
