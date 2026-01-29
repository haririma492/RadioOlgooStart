// app/api/admin/presign/route.ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

type SetKind = "CENTER" | "BG";

function requireAdmin(req: Request) {
  const token = (req.headers.get("x-admin-token") || "").trim();
  return !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

function bad(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

function sanitizeFilename(name: string) {
  // keep simple safe chars, replace others with _
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) return bad(401, "Unauthorized");

  const url = new URL(req.url);
  const set = (url.searchParams.get("set") || "").toUpperCase() as SetKind;
  const filenameRaw = url.searchParams.get("filename") || "";
  const contentType = (url.searchParams.get("contentType") || "").trim();

  if (set !== "CENTER" && set !== "BG") {
    return bad(400, "Missing/invalid set. Use ?set=CENTER or ?set=BG");
  }
  if (!filenameRaw) return bad(400, "Missing filename");
  if (!contentType) return bad(400, "Missing contentType");

  // Enforce your rule: CENTER = mp4 videos, BG = images (you can expand later)
  if (set === "CENTER" && !/^video\//i.test(contentType)) {
    return bad(400, "CENTER only accepts video/* (mp4 recommended).", { contentType });
  }
  if (set === "BG" && !/^image\//i.test(contentType)) {
    return bad(400, "BG only accepts image/*", { contentType });
  }

  const region = (process.env.AWS_REGION || "ca-central-1").trim();

  // IMPORTANT: bucket must exist in env
  const bucket = (process.env.S3_BUCKET || "").trim();
  if (!bucket) {
    return bad(500, "Missing S3_BUCKET in env. Add S3_BUCKET=... to .env.local then restart npm run dev");
  }

  // Public base URL: your app uses this for thumbnails/video playback
  // Prefer NEXT_PUBLIC_S3_PUBLIC_BASE if provided, else derive from bucket+region.
  const publicBase =
    (process.env.NEXT_PUBLIC_S3_PUBLIC_BASE || "").trim() ||
    `https://${bucket}.s3.${region}.amazonaws.com`;

  const filename = sanitizeFilename(filenameRaw);
  const key = `${set}/${Date.now()}-${filename}`;

  try {
    const s3 = new S3Client({ region });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // optional but nice:
      // ACL: "public-read", // DON'T use if your bucket blocks ACLs (recommended). Use bucket policy instead.
    });

    // 5 minutes
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;

    return NextResponse.json({
      ok: true,
      bucket,
      region,
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (e: any) {
    return bad(500, "Presign failed", { detail: e?.message ?? String(e) });
  }
}
