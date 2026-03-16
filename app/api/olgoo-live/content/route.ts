import { NextRequest, NextResponse } from "next/server";
import { scanTable } from "@/lib/olgoo-live/dynamo";

const CONTENT_TABLE_NAME =
  process.env.OLGOO_LIVE_CONTENT_TABLE || "RadioOlgooSlides";

type ContentRow = {
  PK: string;
  title: string;
  url: string;
  section: string;
  group: string;
  person: string;
  sourceType?: string;
  mediaType?: string;
  durationSec?: number;
};

function inferSourceType(url: string): string {
  const lower = (url || "").toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube_embed";
  if (lower.endsWith(".m3u8")) return "hls_stream";
  if (lower.endsWith(".mp3")) return "s3_mp3";
  if (lower.endsWith(".mp4")) return "s3_mp4";
  return "external_stream";
}

function inferMediaType(url: string): string {
  const lower = (url || "").toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return "image";
  if (lower.endsWith(".mp3")) return "audio";
  return "video";
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickTitle(row: Record<string, unknown>): string {
  return pickFirstString(
    row.title,
    row.name,
    row.person,
    row.description,
    row.PK
  );
}

function pickUrl(row: Record<string, unknown>): string {
  return pickFirstString(
    row.url,
    row.mediaUrl,
    row.videoUrl,
    row.audioUrl,
    row.streamUrl,
    row.fileUrl
  );
}

export async function GET(request: NextRequest) {
  try {
    const section = request.nextUrl.searchParams.get("section")?.trim().toLowerCase() || "";
    const group = request.nextUrl.searchParams.get("group")?.trim().toLowerCase() || "";
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") || 300),
      1000
    );

    const rows = await scanTable(CONTENT_TABLE_NAME, 5000);

    const mapped: ContentRow[] = rows
      .map((row) => {
        const title = pickTitle(row);
        const url = pickUrl(row);

        return {
          PK: String(row.PK || ""),
          title,
          url,
          section: String(row.section || ""),
          group: String(row.group || ""),
          person: String(row.person || ""),
          sourceType: row.sourceType ? String(row.sourceType) : inferSourceType(url),
          mediaType: row.mediaType ? String(row.mediaType) : inferMediaType(url),
          durationSec: Number(row.durationSec || row.duration || 0),
        };
      })
      .filter((item) => {
        if (!item.url) return false;

        const rowSection = item.section.toLowerCase();
        const rowGroup = item.group.toLowerCase();

        const haystack = [
          item.title,
          item.section,
          item.group,
          item.person,
          item.PK,
        ]
          .join(" ")
          .toLowerCase();

        if (section && rowSection !== section) return false;
        if (group && rowGroup !== group) return false;
        if (search && !haystack.includes(search)) return false;

        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);

    const sections = Array.from(
      new Set(mapped.map((item) => item.section).filter(nonEmptyString))
    ).sort((a, b) => a.localeCompare(b));

    const groups = Array.from(
      new Set(mapped.map((item) => item.group).filter(nonEmptyString))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      items: mapped,
      sections,
      groups,
      debug: {
        tableName: CONTENT_TABLE_NAME,
        rawRowCount: rows.length,
        matchedCount: mapped.length,
        sampleRawRows: rows.slice(0, 3),
      },
    });
  } catch (error) {
    console.error("GET /api/olgoo-live/content failed", error);
    const message =
      error instanceof Error ? error.message : "Could not load content library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
