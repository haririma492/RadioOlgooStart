// app/api/slides/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in env`);
  return v;
}

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const bucket = (process.env.S3_BUCKET_NAME || "").trim();
const bucketHost = bucket ? `${bucket}.s3.${region}.amazonaws.com` : "";

const s3 = new S3Client({ region });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } }
);

function keyFromS3PublicUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    if (!bucketHost) return null;
    if (u.hostname !== bucketHost) return null;
    const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return key || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/slides?section=Video+Archives&group=Conference
 * Returns items filtered by section and optionally group
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") || "";
    const group = searchParams.get("group") || "";

    if (!section) {
      return json({ error: "Missing section parameter" }, 400);
    }

    const TableName = getEnv("DDB_TABLE_NAME");

    // Scan table and filter by section/group
    const result = await ddb.send(new ScanCommand({ TableName }));
    const allItems = (result.Items || []) as any[];

    // Filter out counters and apply section/group filters
    let items = allItems.filter((x) => {
      if (!x.PK || x.PK.startsWith("COUNTER#")) return false;
      if (!x.url || !x.section) return false;
      if (x.section !== section) return false;
      if (group && x.group !== group) return false;
      return true;
    });

    // Sort by createdAt descending (newest first)
    items.sort((a, b) => {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      return dateB.localeCompare(dateA);
    });

    // Convert S3 URLs to presigned URLs if bucket is private
    if (bucket) {
      items = await Promise.all(
        items.map(async (item) => {
          let urlStr = String(item.url || "");
          const key = keyFromS3PublicUrl(urlStr);

          if (key) {
            urlStr = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: bucket, Key: key }),
              { expiresIn: 60 * 60 } // 1 hour
            );
          }

          return {
            PK: item.PK,
            url: urlStr,
            section: item.section,
            group: item.group || "",
            title: item.title || "",
            person: item.person || "",
            date: item.date || "",
            description: item.description || "",
            active: item.active ?? true,
            createdAt: item.createdAt || "",
          };
        })
      );
    }

    return json({ ok: true, section, group, count: items.length, items });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}