// app/api/admin/presign-get/route.ts
//
// ADMIN API: returns a presigned GET URL for an S3 object
// REQUIRES AUTHENTICATION via x-admin-token header
//
import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || "ca-central-1";
const s3 = new S3Client({ region });

// Default buckets (keep your current one as default)
const ASSETS_BUCKET =
  process.env.ASSETS_BUCKET_NAME || "olgoo-radio-assets-548182874392";

// Your YouTube videos bucket (matches what you showed in the valid URL)
const YOUTUBE_VIDEOS_BUCKET =
  process.env.YOUTUBE_VIDEOS_BUCKET_NAME || "olgoo-radio-videos-548182874392";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

// Verify admin token
function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token) return false;
  return token === expected;
}

// Decide bucket based on key prefix
function bucketForKey(key: string) {
  // put all your youtube downloaded uploads under youtube-videos/
  if (key.startsWith("youtube-videos/")) return YOUTUBE_VIDEOS_BUCKET;

  // everything else stays in assets bucket (media/, images, etc.)
  return ASSETS_BUCKET;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) return json({ error: "Missing key" }, 400);

    const bucket = bucketForKey(key);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // 10 minutes is plenty for "Open"
    const url = await getSignedUrl(s3 as unknown as Parameters<typeof getSignedUrl>[0], command, { expiresIn: 60 * 10 });

    return json({ ok: true, bucket, key, url });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}