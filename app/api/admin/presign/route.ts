import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

type SetKind = "CENTER" | "SLIDES" | "BG";

function json(status: number, obj: any) {
  return NextResponse.json(obj, { status, headers: { "cache-control": "no-store" } });
}

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  return incoming && incoming === expected;
}

function badRequest(message: string) {
  return json(400, { error: message });
}

function isAllowed(set: SetKind, contentType: string) {
  const ct = (contentType || "").toLowerCase();
  if (set === "CENTER") return ct === "video/mp4";
  if (set === "SLIDES") return ct.startsWith("image/");
  if (set === "BG") return ct.startsWith("image/") || ct === "video/mp4";
  return false;
}

function parseSet(raw: string | null): SetKind | null {
  const s = (raw || "").trim().toUpperCase();
  if (s === "CENTER" || s === "SLIDES" || s === "BG") return s as SetKind;
  return null;
}

function sanitizeFilename(filename: string) {
  // keep extension, replace unsafe chars
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Properly encode S3 key for URL while keeping "/" separators
function encodeS3KeyForUrl(key: string) {
  return encodeURIComponent(key).replace(/%2F/g, "/");
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) return json(401, { error: "Unauthorized" });

  const region =
    (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
  const bucket = (process.env.S3_BUCKET_NAME || "").trim();

  if (!region) return json(500, { error: "Missing AWS_REGION (or AWS_DEFAULT_REGION) in env" });
  if (!bucket) return json(500, { error: "Missing S3_BUCKET_NAME in env" });

  const url = new URL(req.url);
  const set = parseSet(url.searchParams.get("set"));
  const filename = (url.searchParams.get("filename") || "").trim();
  const contentType = (url.searchParams.get("contentType") || "").trim();

  if (!set) return badRequest("Missing/invalid set. Use ?set=CENTER or ?set=SLIDES or ?set=BG");
  if (!filename) return badRequest("Missing filename");
  if (!contentType) return badRequest("Missing contentType");

  if (!isAllowed(set, contentType)) {
    return badRequest(
      set === "CENTER"
        ? "CENTER accepts only video/mp4"
        : set === "SLIDES"
        ? "SLIDES accepts only image/*"
        : "BG accepts image/* or video/mp4"
    );
  }

  const safeName = sanitizeFilename(filename);

  // Key format: <SET>/<timestamp>-<safeName>
  const key = `${set}/${Date.now()}-${safeName}`;

  try {
    const s3 = new S3Client({ region });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // cache for public viewing (even if bucket is private, this header is fine)
      CacheControl: "public, max-age=31536000, immutable",
      // NOTE: do NOT set ACL here unless you intentionally allow public-read.
      // ACL: "public-read",
    });

    // presigned PUT url (upload only)
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    // clean URL for viewing (NO X-Amz params)
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

    return json(200, { ok: true, set, key, uploadUrl, publicUrl });
  } catch (e: any) {
    return json(500, { error: "Presign failed", detail: e?.message ?? String(e) });
  }
}
