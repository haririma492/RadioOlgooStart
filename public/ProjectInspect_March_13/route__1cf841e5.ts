// app/api/admin/register-from-s3/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });

const BUCKET = "olgoo-radio-assets-548182874392";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token")?.trim();
  const expected = process.env.ADMIN_TOKEN?.trim();
  return !!expected && token === expected;
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// ──────────────────────────────────────────────────────────────
// GET: scan prefix and return files NOT in DynamoDB
// ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const prefix = (searchParams.get("prefix") || "media/").trim().replace(/\/$/, "") + "/";

  try {
    const TableName = getEnv("DDB_TABLE_NAME");

    // 1. Get all existing S3 keys from DynamoDB (cached in memory for speed)
    const scan = await ddb.send(new ScanCommand({ TableName }));
    const existingKeys = new Set<string>();

    if (scan.Items) {
      for (const it of scan.Items) {
        if (it.url) {
          try {
            const u = new URL(it.url);
            let key = u.pathname.replace(/^\/+/, "");
            if (key.startsWith(BUCKET + "/")) key = key.slice(BUCKET.length + 1);
            if (key) existingKeys.add(key);
          } catch {}
        }
      }
    }

    console.log(`Found ${existingKeys.size} existing keys in DynamoDB`);

    // 2. List ALL objects in prefix (with pagination)
    const allObjects: any[] = [];
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        // Remove Delimiter to get ALL files (including nested)
      });

      const s3Res = await s3.send(listCmd);

      if (s3Res.Contents) {
        allObjects.push(
          ...s3Res.Contents
            .filter((obj) => obj.Key && obj.Key !== prefix && !obj.Key.endsWith("/"))
            .map((obj) => ({
              key: obj.Key!,
              size: obj.Size || 0,
              lastModified: obj.LastModified,
              filename: obj.Key!.split("/").pop() || obj.Key!,
            }))
        );
      }

      continuationToken = s3Res.NextContinuationToken;
    } while (continuationToken);

    console.log(`Listed ${allObjects.length} objects in S3 prefix ${prefix}`);

    // 3. Filter missing
    const missing = allObjects.filter((obj) => !existingKeys.has(obj.key));

    return NextResponse.json({
      ok: true,
      prefix,
      missing,
      totalInS3: allObjects.length,
      missingCount: missing.length,
    });
  } catch (e: any) {
    console.error("Scan S3 error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to scan S3 or DynamoDB" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────
// POST: register selected keys into DynamoDB
// ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { prefix, section, group, selectedKeys } = body;

    if (!prefix || !section || !Array.isArray(selectedKeys) || selectedKeys.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const TableName = getEnv("DDB_TABLE_NAME");
    const now = new Date().toISOString();
    let created = 0;

    for (const key of selectedKeys) {
      if (typeof key !== "string") continue;

      const url = `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;
      const filename = key.split("/").pop() || key;
      const title = filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ").trim() || filename;

      const PK = `MEDIA#${Date.now()}#${Math.random().toString(36).substring(2, 10)}`;

      const Item = {
        PK,
        url,
        section: section.trim(),
        title,
        group: group ? group.trim() : "",
        person: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await ddb.send(new PutCommand({ TableName, Item }));
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (e: any) {
    console.error("Register error:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}