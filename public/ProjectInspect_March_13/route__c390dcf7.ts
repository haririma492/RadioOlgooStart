// app/api/admin/presign/route.ts
//
// GENERIC S3 PATHS: media/<timestamp>-<filename>
// Section is passed through for metadata but doesn't affect the S3 key structure.
//

import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Force Node.js runtime (longer timeouts, better for S3/DynamoDB)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple admin check helper
function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  return incoming && incoming === expected;
}

// Sanitize filename to avoid invalid S3 keys
function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Encode key for public URL (preserve slashes)
function encodeS3KeyForUrl(key: string) {
  return encodeURIComponent(key).replace(/%2F/g, "/");
}

// Handle OPTIONS preflight (required for CORS on file uploads)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*", // Change to your exact domain in production
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Main presign handler
export async function GET(req: Request) {
  // Check admin token
  if (!requireAdmin(req)) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }

  const region = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
  const bucket = (process.env.S3_BUCKET_NAME || "").trim();

  if (!region) {
    return new NextResponse(JSON.stringify({ error: "Missing AWS_REGION in env" }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
  if (!bucket) {
    return new NextResponse(JSON.stringify({ error: "Missing S3_BUCKET_NAME in env" }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const section = (url.searchParams.get("section") || "").trim();
  const filename = (url.searchParams.get("filename") || "").trim();
  const contentType = (url.searchParams.get("contentType") || "").trim();

  if (!section) {
    return new NextResponse(JSON.stringify({ error: "Missing section parameter" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
  if (!filename) {
    return new NextResponse(JSON.stringify({ error: "Missing filename" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
  if (!contentType) {
    return new NextResponse(JSON.stringify({ error: "Missing contentType" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  // Validate content types
  const ct = contentType.toLowerCase();
  const isVideo = ct.startsWith("video/");
  const isImage = ct.startsWith("image/");
  if (!isVideo && !isImage) {
    return new NextResponse(JSON.stringify({ error: "Only video/* and image/* content types are allowed" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  const safeName = sanitizeFilename(filename);
  const key = `media/${Date.now()}-${safeName}`;

  try {
    const s3 = new S3Client({ region });
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(s3 as unknown as Parameters<typeof getSignedUrl>[0], cmd, { expiresIn: 300 });
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

    return new NextResponse(
      JSON.stringify({ ok: true, section, key, uploadUrl, publicUrl }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // ← Change to your domain later
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
        },
      }
    );
  } catch (e: any) {
    console.error("Presign error:", e);
    return new NextResponse(
      JSON.stringify({ error: "Presign failed", detail: e?.message ?? String(e) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}