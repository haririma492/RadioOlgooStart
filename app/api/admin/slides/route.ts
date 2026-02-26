// app/api/admin/slides/route.ts
//
// ADMIN API: CRUD operations for media items
// REQUIRES AUTHENTICATION via x-admin-token header
//
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || "ca-central-1";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const s3 = new S3Client({ region });

/**
 * IMPORTANT:
 * This must match the bucket used in your upload route.
 * Set this in .env.local:
 *
 * S3_BUCKET_NAME=olgoo-radio-videos-548182874392
 */
const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
if (!BUCKET_NAME) {
  throw new Error("Missing S3_BUCKET_NAME in environment variables");
}

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

// Verify admin token
function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token) return false;
  return token === expected;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/admin/slides
// ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const TableName = getEnv("DDB_TABLE_NAME");
    const result = await ddb.send(new ScanCommand({ TableName }));

    const items = (result.Items || []).filter((x: any) => {
      if (!x.PK) return false;
      const pk = String(x.PK);
      return pk.startsWith("MEDIA#") || pk.startsWith("VIDEOARCHIVE#");
    });

    items.sort((a: any, b: any) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );

    return json({ ok: true, items, count: items.length });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/admin/slides
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const { url, section, title, group, person, date, description } = body;

    if (!url || !section || !title) {
      return json({ error: "Missing required fields" }, 400);
    }

    const TableName = getEnv("DDB_TABLE_NAME");

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 15);
    const PK = `MEDIA#${timestamp}#${rand}`;
    const now = new Date().toISOString();

    const Item: any = {
      PK,
      url,
      section,
      title,
      group: group || "",
      person: person || "",
      date: date || new Date().toISOString().split("T")[0],
      description: description || "",
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName, Item }));

    return json({ ok: true, PK, title });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/admin/slides
// ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const { PK, date, ...otherFields } = body;

    if (!PK) {
      return json({ error: "Missing PK" }, 400);
    }

    const TableName = getEnv("DDB_TABLE_NAME");

    const existingResult = await ddb.send(
      new GetCommand({ TableName, Key: { PK } })
    );

    const existingItem = existingResult.Item;
    if (!existingItem) {
      return json({ error: "Item not found" }, 404);
    }

    const updatedItem: any = {
      ...existingItem,
      ...otherFields,
      PK,
      date: date || existingItem.date,
      createdAt: existingItem.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName, Item: updatedItem }));

    return json({ ok: true, PK });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/admin/slides?PK=xxx
// ─────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { searchParams } = new URL(req.url);
    const PK = searchParams.get("PK");

    if (!PK) {
      return json({ error: "Missing PK parameter" }, 400);
    }

    const TableName = getEnv("DDB_TABLE_NAME");

    const getResult = await ddb.send(
      new GetCommand({ TableName, Key: { PK } })
    );

    const item = getResult.Item as any;
    if (!item) {
      return json({ error: "Item not found" }, 404);
    }

    // Extract S3 key from URL
    let s3Key: string | null = null;
    if (item.url) {
      try {
        const urlObj = new URL(item.url);
        s3Key = urlObj.pathname.replace(/^\/+/, "");
      } catch {
        console.warn("Could not parse URL for S3 deletion:", item.url);
      }
    }

    // Delete DynamoDB record first
    await ddb.send(new DeleteCommand({ TableName, Key: { PK } }));

    // Delete S3 object (safe mode)
    let deletedFromS3 = false;
    if (s3Key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
          })
        );
        deletedFromS3 = true;
        console.log("Deleted S3 object:", s3Key);
      } catch (err: any) {
        // Ignore missing key errors
        if (
          err?.name === "NoSuchKey" ||
          err?.Code === "NoSuchKey"
        ) {
          console.log("S3 object already missing:", s3Key);
        } else {
          console.error("S3 deletion error:", err);
        }
      }
    }

    return json({
      ok: true,
      PK,
      deletedFromS3,
    });
  } catch (e: any) {
    console.error("Delete error:", e);
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}