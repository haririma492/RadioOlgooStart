// app/api/admin/youtube/download-upload/route.ts
// Use yt-dlp via command line - same as Python version!
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
const YTDLP_PATH = process.env.YTDLP_PATH; // Path to yt-dlp executable

// Initialize AWS clients
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

// Helper to find yt-dlp
function getYtDlpPath(): string {
  // First, try the path from .env.local
  if (YTDLP_PATH && existsSync(YTDLP_PATH)) {
    console.log(`   Using yt-dlp from .env.local: ${YTDLP_PATH}`);
    return YTDLP_PATH;
  }
  
  // Try to find in PATH
  try {
    const result = execSync("where yt-dlp", { encoding: "utf-8", windowsHide: true }).trim();
    const path = result.split("\n")[0].trim();
    console.log(`   Found yt-dlp in PATH: ${path}`);
    return path;
  } catch {
    // Fallback to just "yt-dlp" and hope it's in PATH
    console.log(`   Using default: yt-dlp (hoping it's in PATH)`);
    return "yt-dlp";
  }
}

// Helper to generate PK
function generatePK(): string {
  return `MEDIA#${Date.now()}#${uuidv4()}`;
}

// Download video using yt-dlp with progress tracking
function downloadVideoYtDlp(videoUrl: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlpPath = getYtDlpPath();
    
    console.log(`   📥 Starting yt-dlp download...`);
    
    const quotedYtdlpPath = ytdlpPath.includes(' ') ? `"${ytdlpPath}"` : ytdlpPath;
    const quotedOutputPath = outputPath.includes(' ') ? `"${outputPath}"` : outputPath;
    
    const command = `${quotedYtdlpPath} -f best -o ${quotedOutputPath} --newline "${videoUrl}"`;
    
    const ytdlp = spawn(command, [], {
      windowsHide: true,
      shell: true,
    });

    let lastProgress = "";

    ytdlp.stdout.on("data", (data) => {
      const line = data.toString().trim();
      
      // Show download progress
      if (line.includes('[download]') && line.includes('%')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) {
          const progress = match[1];
          if (progress !== lastProgress) {
            process.stdout.write(`\r   ⬇️  Downloading: ${progress}%`);
            lastProgress = progress;
          }
        }
      } else if (line.includes('[download]') && line.includes('100%')) {
        console.log(`\r   ✅ Download complete!                    `);
      }
    });

    ytdlp.stderr.on("data", (data) => {
      const line = data.toString().trim();
      if (line && !line.includes('WARNING')) {
        console.log(`   ${line}`);
      }
    });

    ytdlp.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed (code ${code})`));
        return;
      }

      const extensions = ["", ".mp4", ".webm", ".mkv"];
      const basePath = outputPath.replace(/\.[^.]+$/, "");
      
      for (const ext of extensions) {
        const path = ext ? basePath + ext : outputPath;
        if (existsSync(path)) {
          resolve(path);
          return;
        }
      }

      reject(new Error("File not found after download"));
    });

    ytdlp.on("error", (error) => {
      reject(new Error(`Failed to run yt-dlp: ${error.message}`));
    });
  });
}

// Upload to S3
async function uploadToS3(filePath: string, s3Key: string): Promise<string> {
  const sizeMB = (statSync(filePath).size / (1024 * 1024)).toFixed(2);
  
  console.log(`   ⬆️  Uploading ${sizeMB} MB to S3...`);
  const startTime = Date.now();
  
  const fileStream = createReadStream(filePath);

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET_VIDEOS,
    Key: s3Key,
    Body: fileStream,
    ContentType: "video/mp4",
    // Note: Bucket has ACLs disabled, so we rely on bucket policy for public access
  }));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const url = `https://${S3_BUCKET_VIDEOS}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  
  console.log(`   ✅ Upload complete! (${sizeMB} MB in ${duration}s)`);
  return url;
}

// Helper to parse YouTube upload date to YYYY-MM-DD format
function parseYouTubeDate(uploadDate: string): string {
  try {
    // uploadDate is like "February 8, 2026" or similar
    const date = new Date(uploadDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0]; // YYYY-MM-DD
    }
  } catch (error) {
    console.log(`   ⚠️  Could not parse date: ${uploadDate}, using today`);
  }
  // Fallback to today if parsing fails
  return new Date().toISOString().split("T")[0];
}

// Save to DynamoDB
async function saveToDynamoDB(item: any): Promise<void> {
  console.log(`   💾 Saving to DynamoDB...`);
  
  await docClient.send(new PutCommand({
    TableName: DDB_TABLE_NAME,
    Item: {
      ...item,
      active: true,
      updatedAt: new Date().toISOString(),
    },
  }));
  
  console.log(`   ✅ Saved to DynamoDB`);
}

export async function POST(request: NextRequest) {
  try {
    console.log("\n=== YouTube Download Started ===\n");
    
    const adminToken = request.headers.get("x-admin-token");
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videos } = await request.json();
    if (!videos?.length) {
      return NextResponse.json({ error: "No videos" }, { status: 400 });
    }
    
    console.log(`📦 Processing ${videos.length} video(s)\n`);

    const results = [];
    let successCount = 0;

    for (const video of videos) {
      let tempFile: string | null = null;

      try {
        console.log(`\n${"━".repeat(80)}`);
        console.log(`📹 ${video.title}`);
        console.log(`━`.repeat(80));

        // Download
        const safeTitle = video.title.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
        tempFile = join(tmpdir(), `${Date.now()}_${safeTitle}.mp4`);
        
        console.log(`\n⬇️  Downloading with yt-dlp...`);
        const downloaded = await downloadVideoYtDlp(video.url, tempFile);

        // Upload to S3
        const s3Key = `youtube-videos/${Date.now()}_${safeTitle}.mp4`;
        const s3Url = await uploadToS3(downloaded, s3Key);

        // Clean up
        if (existsSync(downloaded)) unlinkSync(downloaded);

        // Save to DB
        const pk = generatePK();
        
        // Parse YouTube upload date to use as createdAt
        const youtubeUploadDate = parseYouTubeDate(video.uploadDate);
        const youtubeCreatedAt = new Date(youtubeUploadDate).toISOString();
        
        console.log(`   📅 YouTube upload date: ${video.uploadDate} → ${youtubeUploadDate}`);
        
        await saveToDynamoDB({
          PK: pk,
          url: s3Url,
          section: "Youtube Chanel Videos",
          title: video.title,
          group: video.group,
          person: video.channelTitle,
          date: youtubeUploadDate, // Use YouTube upload date
          description: `Views: ${video.viewCount?.toLocaleString() || "N/A"}`,
          createdAt: youtubeCreatedAt, // Use YouTube upload date as creation timestamp
        });

        successCount++;
        results.push({
          success: true,
          videoId: video.videoId,
          title: video.title,
          s3Url,
        });

        console.log(`\n✅ SUCCESS!\n`);
      } catch (error: any) {
        console.error(`\n❌ FAILED: ${error.message}\n`);
        
        results.push({
          success: false,
          videoId: video.videoId,
          title: video.title,
          error: error.message,
        });

        if (tempFile && existsSync(tempFile)) {
          try { unlinkSync(tempFile); } catch {}
        }
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
    console.error("\n❌ Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}