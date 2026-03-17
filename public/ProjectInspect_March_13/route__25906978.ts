// app/api/admin/youtube/download-upload/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { spawn, execSync } from "child_process";
import { createReadStream, unlinkSync, existsSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const AWS_REGION = process.env.AWS_REGION || "ca-central-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const S3_BUCKET_VIDEOS = process.env.S3_VIDEO_BUCKET;
const DDB_TABLE_NAME = process.env.DDB_TABLE_NAME;

const YTDLP_PATH = process.env.YTDLP_PATH; // optional explicit path

function assertEnv() {
  const missing: string[] = [];
  if (!ADMIN_TOKEN) missing.push("ADMIN_TOKEN");
  if (!AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!S3_BUCKET_VIDEOS) missing.push("S3_VIDEO_BUCKET");
  if (!DDB_TABLE_NAME) missing.push("DDB_TABLE_NAME");
  if (missing.length) throw new Error(`Missing required env var(s): ${missing.join(", ")}`);
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

const ddbClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(ddbClient);

// ─────────────────────────────────────────────────────────────────────────────
// yt-dlp discovery / provisioning
// ─────────────────────────────────────────────────────────────────────────────

const isWin = process.platform === "win32";

function tryFindYtDlpInPath(): string | null {
  try {
    const cmd = isWin ? "where yt-dlp" : "which yt-dlp";
    const result = execSync(cmd, { encoding: "utf-8" }).trim();
    const first = result.split(/\r?\n/)[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

// IMPORTANT: avoid static require so Next doesn't try to resolve if not installed
async function tryLoadYtDlpWrap(): Promise<any | null> {
  try {
    const mod: any = await import("yt-dlp-wrap");
    return mod?.default || mod;
  } catch {
    return null;
  }
}

let ytDlpWrapBinaryPromise: Promise<string> | null = null;

async function getYtDlpPath(): Promise<string> {
  // 1) explicit env
  if (YTDLP_PATH && existsSync(YTDLP_PATH)) {
    console.log(`   Using yt-dlp from YTDLP_PATH: ${YTDLP_PATH}`);
    return YTDLP_PATH;
  }

  // 2) system PATH
  const inPath = tryFindYtDlpInPath();
  if (inPath && existsSync(inPath)) {
    console.log(`   Found yt-dlp in PATH: ${inPath}`);
    return inPath;
  }

  // 3) yt-dlp-wrap (optional)
  const YTDlpWrap = await tryLoadYtDlpWrap();
  if (YTDlpWrap) {
    if (!ytDlpWrapBinaryPromise) {
      ytDlpWrapBinaryPromise = (async () => {
        const wrap = new YTDlpWrap();
        const target = join(tmpdir(), isWin ? "yt-dlp.exe" : "yt-dlp");
        const binPath: string = await wrap.getYtDlpBinary(target);
        console.log(`   Provisioned yt-dlp via yt-dlp-wrap at: ${binPath}`);
        return binPath;
      })();
    }
    return ytDlpWrapBinaryPromise;
  }

  throw new Error(
    [
      "yt-dlp not found.",
      "Fix options:",
      "  A) Local Windows: install yt-dlp and ensure it's in PATH, or set YTDLP_PATH to full exe path.",
      "  B) Vercel/Linux: install dependency `yt-dlp-wrap` (npm i yt-dlp-wrap) OR bundle yt-dlp and set YTDLP_PATH.",
    ].join(" ")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function generatePK(): string {
  return `MEDIA#${Date.now()}#${uuidv4()}`;
}

function safeSlug(s: string, max = 80) {
  return (s || "video")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, max);
}

function contentTypeFromPath(p: string) {
  const low = p.toLowerCase();
  if (low.endsWith(".mp4")) return "video/mp4";
  if (low.endsWith(".webm")) return "video/webm";
  if (low.endsWith(".mkv")) return "video/x-matroska";
  return "application/octet-stream";
}

async function downloadVideoYtDlp(videoUrl: string, outputPath: string): Promise<string> {
  const ytdlpPath = await getYtDlpPath();

  console.log(`   📥 Starting yt-dlp download...`);

  const args = ["-f", "best", "-o", outputPath, "--newline", videoUrl];

  const child = spawn(ytdlpPath, args, { windowsHide: true, shell: false });

  let lastProgress = "";

  child.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line.includes("[download]") && line.includes("%")) {
      const match = line.match(/(\d+(?:\.\d+)?)%/);
      if (match) {
        const progress = match[1];
        if (progress !== lastProgress) {
          process.stdout.write(`\r   ⬇️  Downloading: ${progress}%`);
          lastProgress = progress;
        }
      }
    }
    if (line.includes("100%")) process.stdout.write(`\r   ✅ Download complete!                    \n`);
  });

  child.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (!line) return;
    if (line.toLowerCase().includes("warning")) return;
    console.log(`   ${line}`);
  });

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve(code ?? -1));
  });

  if (exitCode !== 0) throw new Error(`yt-dlp failed (code ${exitCode})`);

  // Confirm output exists (yt-dlp may change extension)
  const candidates = [
    outputPath,
    outputPath.replace(/\.mp4$/i, ".webm"),
    outputPath.replace(/\.mp4$/i, ".mkv"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;

  const base = outputPath.replace(/\.[^.]+$/, "");
  for (const p of [base + ".mp4", base + ".webm", base + ".mkv"]) if (existsSync(p)) return p;

  throw new Error("File not found after download");
}

async function uploadToS3(filePath: string, s3Key: string): Promise<{ url: string; sizeMB: string; s3Key: string }> {
  const sizeMB = (statSync(filePath).size / (1024 * 1024)).toFixed(2);

  console.log(`   ⬆️  Uploading ${sizeMB} MB to S3...`);
  const startTime = Date.now();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_VIDEOS!,
      Key: s3Key,
      Body: createReadStream(filePath),
      ContentType: contentTypeFromPath(filePath),
    })
  );
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const url = `https://${S3_BUCKET_VIDEOS}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  console.log(`   ✅ Upload complete! (${sizeMB} MB in ${duration}s)`);
console.log("UPLOAD TARGET =>", { bucket: S3_BUCKET_VIDEOS, key: s3Key });

  return { url, sizeMB, s3Key };
}

function parseYouTubeDate(uploadDate: string): string {
  try {
    const d = new Date(uploadDate);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

async function saveToDynamoDB(item: any): Promise<void> {
  console.log(`   💾 Saving to DynamoDB...`);

  await docClient.send(
    new PutCommand({
      TableName: DDB_TABLE_NAME!,
      Item: {
        ...item,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  console.log(`   ✅ Saved to DynamoDB`);
}

// ─────────────────────────────────────────────────────────────────────────────
// handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    assertEnv();

    console.log("\n=== YouTube Download Started ===\n");

    const adminToken = request.headers.get("x-admin-token");
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const videos = body?.videos;

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "No videos" }, { status: 400 });
    }

    console.log(`📦 Processing ${videos.length} video(s)\n`);

    const results: any[] = [];
    let successCount = 0;

    for (const video of videos) {
      let tempOutPath: string | null = null;
      let downloadedPath: string | null = null;

      try {
        console.log(`\n${"━".repeat(80)}`);
        console.log(`📹 ${video?.title ?? "(no title)"}`);
        console.log(`━`.repeat(80));

        const title = String(video?.title ?? "video");
        const url = String(video?.url ?? "");
        if (!url.trim()) throw new Error("Missing video.url");

        const safeTitle = safeSlug(title, 60);
        tempOutPath = join(tmpdir(), `${Date.now()}_${safeTitle}.mp4`);

        console.log(`\n⬇️  Downloading with yt-dlp...`);
        downloadedPath = await downloadVideoYtDlp(url, tempOutPath);

        const s3Key = `youtube-videos/${Date.now()}_${safeTitle}${downloadedPath.toLowerCase().endsWith(".webm") ? ".webm" : downloadedPath.toLowerCase().endsWith(".mkv") ? ".mkv" : ".mp4"}`;
        const { url: s3Url, sizeMB } = await uploadToS3(downloadedPath, s3Key);

        // cleanup local temp
        if (downloadedPath && existsSync(downloadedPath)) {
          try {
            unlinkSync(downloadedPath);
          } catch {}
        }

        const pk = generatePK();
        const youtubeUploadDate = parseYouTubeDate(String(video?.uploadDate ?? ""));
        const youtubeCreatedAt = new Date(youtubeUploadDate).toISOString();

        console.log(`   📅 YouTube upload date: ${video.uploadDate} → ${youtubeUploadDate}`);

        // IMPORTANT: respect section passed from client (fallback to your legacy value)
        const section = String(video?.section || "Youtube Chanel Videos");

        await saveToDynamoDB({
          PK: pk,
          url: s3Url,
          section,
          title,
          group: String(video?.group ?? ""),
          person: String(video?.channelTitle ?? ""),
          date: youtubeUploadDate,
          description: `Views: ${video?.viewCount?.toLocaleString?.() ?? "N/A"}`,
          createdAt: youtubeCreatedAt,
        });

        successCount++;
        results.push({
          success: true,
          videoId: video.videoId,
          title,
          s3Url,
          size: `${sizeMB} MB`,
          s3Key,
        });

        console.log(`\n✅ SUCCESS!\n`);
      } catch (error: any) {
        const msg = error?.message ?? String(error);
        console.error(`\n❌ FAILED: ${msg}\n`);

        for (const p of [downloadedPath, tempOutPath]) {
          if (p && existsSync(p)) {
            try {
              unlinkSync(p);
            } catch {}
          }
        }

        results.push({
          success: false,
          videoId: video?.videoId,
          title: video?.title,
          error: msg,
        });
      }
    }

    console.log(`\n✅ Done: ${successCount}/${videos.length}\n`);

    return NextResponse.json({
      success: true,
      successCount,
      failCount: videos.length - successCount,
      total: videos.length,
      results,
    });
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("\n❌ Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}