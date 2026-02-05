// app/api/admin/presign/route.ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

const SECTION_PREFIX: Record<string, string> = {
  "Video Archives": "VIDEOARCHIVE",
  "Single Videos-Songs": "SINGLEVIDEO",
  "National Anthems": "ANTHEM",
  "Photo Albums": "PHOTOALBUM",
  "Live Channels": "LIVECHANNEL",
  "Social Media Profiles": "SOCIAL",
  "Great-National-Songs-Videos": "GREATSONG",
  "In-Transition": "TRANSITION",
};

function json(status: number, obj: any) {
  return NextResponse.json(obj, { status, headers: { "cache-control": "no-store" } });
}

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  return incoming && incoming === expected;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function encodeS3KeyForUrl(key: string) {
  return encodeURIComponent(key).replace(/%2F/g, "/");
}

/**
 * GET /api/admin/presign?section=Video+Archives&filename=video.mp4&contentType=video/mp4
 * Returns presigned URL for uploading to S3
 */
export async function GET(req: Request) {
  if (!requireAdmin(req)) return json(401, { error: "Unauthorized" });

  const region = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
  const bucket = (process.env.S3_BUCKET_NAME || "").trim();

  if (!region) return json(500, { error: "Missing AWS_REGION in env" });
  if (!bucket) return json(500, { error: "Missing S3_BUCKET_NAME in env" });

  const url = new URL(req.url);
  const section = (url.searchParams.get("section") || "").trim();
  const filename = (url.searchParams.get("filename") || "").trim();
  const contentType = (url.searchParams.get("contentType") || "").trim();

  if (!section || !SECTION_PREFIX[section]) {
    return json(400, { 
      error: `Invalid section. Must be one of: ${Object.keys(SECTION_PREFIX).join(", ")}` 
    });
  }
  if (!filename) return json(400, { error: "Missing filename" });
  if (!contentType) return json(400, { error: "Missing contentType" });

  // Validate content types
  const ct = contentType.toLowerCase();
  const isVideo = ct.startsWith("video/");
  const isImage = ct.startsWith("image/");
  
  if (!isVideo && !isImage) {
    return json(400, { error: "Only video/* and image/* content types are allowed" });
  }

  const safeName = sanitizeFilename(filename);
  const prefix = SECTION_PREFIX[section];
  
  // Key format: <PREFIX>/<timestamp>-<filename>
  const key = `${prefix}/${Date.now()}-${safeName}`;

  try {
    const s3 = new S3Client({ region });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

    return json(200, { ok: true, section, key, uploadUrl, publicUrl });
  } catch (e: any) {
    return json(500, { error: "Presign failed", detail: e?.message ?? String(e) });
  }
}