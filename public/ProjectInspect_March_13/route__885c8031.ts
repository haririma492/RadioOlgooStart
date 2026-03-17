// app/api/admin/import-url/route.ts
//
// Import video from URL (X/Twitter, YouTube, etc.) using yt-dlp.
// Server-side: yt-dlp downloads → S3 upload → DynamoDB register.
//
// REQUIRES: yt-dlp installed on the server (pip install yt-dlp)
//
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { readFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Allow up to 5 minutes for large video downloads
export const maxDuration = 300;

// ── Clients ────────────────────────────────────────────────────────────
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const bucket = (process.env.S3_BUCKET_NAME || "").trim();

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region });

function tableName() {
  const v = (process.env.DDB_TABLE_NAME || "").trim();
  if (!v) throw new Error("Missing DDB_TABLE_NAME in env");
  return v;
}

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) throw new Error("Missing ADMIN_TOKEN in env");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function jsonOk(obj: any, status = 200) {
  return NextResponse.json(obj, { status, headers: { "cache-control": "no-store" } });
}

function jsonErr(error: string, status = 400, detail?: any) {
  return NextResponse.json(
    { error, ...(detail ? { detail: String(detail) } : {}) },
    { status, headers: { "cache-control": "no-store" } }
  );
}

function generatePK(): string {
  const ts = Date.now();
  const rand = randomUUID().replace(/-/g, "").slice(0, 14);
  return `MEDIA#${ts}#${rand}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * POST /api/admin/import-url
 *
 * Body JSON:
 *   url       - (required) Source URL (X/Twitter, YouTube, etc.)
 *   section   - (required) Target section
 *   title     - (required) Title for the media item
 *   group     - (optional) Target group
 *   person    - (optional) Person/artist
 *   date      - (optional) Date string
 *   description - (optional) Description
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  if (!bucket) return jsonErr("Missing S3_BUCKET_NAME in env", 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Bad JSON body", 400);
  }

  const sourceUrl = String(body.url || "").trim();
  const section = String(body.section || "").trim();
  const title = String(body.title || "").trim();

  if (!sourceUrl) return jsonErr("Missing url", 400);
  if (!section) return jsonErr("Missing section", 400);
  if (!title) return jsonErr("Missing title", 400);

  // Basic URL validation
  try {
    const u = new URL(sourceUrl);
    if (!["http:", "https:"].includes(u.protocol)) {
      return jsonErr("Invalid URL protocol", 400);
    }
  } catch {
    return jsonErr("Invalid URL format", 400);
  }

  // ── 1. Download with yt-dlp ──────────────────────────────────────────
  const workDir = join(tmpdir(), `import-${Date.now()}-${randomUUID().slice(0, 8)}`);
  mkdirSync(workDir, { recursive: true });

  let downloadedFile: string | null = null;
  let videoTitle = title; // fallback to user-provided title

  try {
    // Download best quality, merge to mp4, write metadata
    const cmd = [
      "yt-dlp",
      "--no-playlist",
      "--merge-output-format", "mp4",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--no-warnings",
      "--print-json",
      "-o", join(workDir, "%(id)s.%(ext)s"),
      sourceUrl,
    ].join(" ");

    const stdout = execSync(cmd, {
      timeout: 4 * 60 * 1000, // 4 min timeout
      maxBuffer: 10 * 1024 * 1024, // 10 MB stdout buffer
      encoding: "utf-8",
    });

    // Parse yt-dlp JSON output for metadata
    try {
      const meta = JSON.parse(stdout.trim().split("\n").pop() || "{}");
      if (meta.title && !body.title) videoTitle = meta.title;
    } catch {}

    // Find the downloaded file
    const files = readdirSync(workDir);
    if (!files.length) throw new Error("yt-dlp produced no output file");
    downloadedFile = join(workDir, files[0]);
  } catch (e: any) {
    cleanup(workDir);
    const msg = e?.message || String(e);
    if (msg.includes("command not found") || msg.includes("ENOENT")) {
      return jsonErr(
        "yt-dlp is not installed on the server. Install with: pip install yt-dlp",
        500
      );
    }
    return jsonErr(`Download failed: ${msg.slice(0, 500)}`, 500);
  }

  // ── 2. Upload to S3 ─────────────────────────────────────────────────
  let s3PublicUrl: string;
  try {
    const fileBuffer = readFileSync(downloadedFile);
    const originalName = downloadedFile.split("/").pop() || "video.mp4";
    const safeName = sanitizeFilename(originalName);
    const s3Key = `media/${Date.now()}-${safeName}`;
    const contentType = guessContentType(safeName);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    s3PublicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  } catch (e: any) {
    cleanup(workDir);
    return jsonErr(`S3 upload failed: ${e?.message}`, 500);
  }

  // ── 3. Register in DynamoDB ──────────────────────────────────────────
  let PK: string;
  try {
    PK = generatePK();
    const TableName = tableName();

    const item: any = {
      PK,
      url: s3PublicUrl,
      section,
      title: videoTitle,
      source: sourceUrl, // keep original URL for reference
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (body.group) item.group = String(body.group).trim();
    if (body.person) item.person = String(body.person).trim();
    if (body.date) item.date = String(body.date).trim();
    if (body.description) item.description = String(body.description).trim();

    await ddb.send(new PutCommand({ TableName, Item: item }));
  } catch (e: any) {
    cleanup(workDir);
    return jsonErr(`DynamoDB failed: ${e?.message}`, 500);
  }

  // ── 4. Cleanup ───────────────────────────────────────────────────────
  cleanup(workDir);

  return jsonOk({
    ok: true,
    PK,
    title: videoTitle,
    source: sourceUrl,
    s3Url: s3PublicUrl,
  });
}

function cleanup(dir: string) {
  try {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)); } catch {}
    }
    try { require("fs").rmdirSync(dir); } catch {}
  } catch {}
}