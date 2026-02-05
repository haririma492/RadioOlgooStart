// app/api/admin/slides/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Section to PK prefix mapping
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
  return NextResponse.json(obj, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function jsonErr(error: string, status = 400, detail?: any) {
  return jsonOk({ error, ...(detail ? { detail: String(detail) } : {}) }, status);
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1",
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const bucket = (process.env.S3_BUCKET_NAME || "").trim();
const bucketHost = bucket ? `${bucket}.s3.${region}.amazonaws.com` : "";
const s3 = new S3Client({ region });

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

function tableName() {
  const v = (process.env.DDB_TABLE_NAME || "").trim();
  if (!v) throw new Error("Missing DDB_TABLE_NAME in env");
  return v;
}

/**
 * Get next sequence number for a section using atomic counter
 */
async function getNextId(prefix: string): Promise<number> {
  const TableName = tableName();
  const counterKey = `COUNTER#${prefix}`;

  const result = await ddb.send(
    new UpdateCommand({
      TableName,
      Key: { PK: counterKey },
      UpdateExpression: "SET nextId = if_not_exists(nextId, :start) + :inc",
      ExpressionAttributeValues: {
        ":start": 0,
        ":inc": 1,
      },
      ReturnValues: "UPDATED_NEW",
    })
  );

  return result.Attributes?.nextId || 1;
}

/**
 * Generate PK like VIDEOARCHIVE#0001
 */
async function generatePK(section: string): Promise<string> {
  const prefix = SECTION_PREFIX[section];
  if (!prefix) throw new Error(`Unknown section: ${section}`);

  const nextId = await getNextId(prefix);
  const paddedId = String(nextId).padStart(4, "0");

  return `${prefix}#${paddedId}`;
}

/**
 * GET - List items
 * Query params:
 *   - section: (optional) filter by section
 *   - group: (optional) filter by group
 */
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const url = new URL(req.url);
    const sectionFilter = url.searchParams.get("section");
    const groupFilter = url.searchParams.get("group");

    // If no filters, scan entire table (excluding counters)
    if (!sectionFilter) {
      const result = await ddb.send(new ScanCommand({ TableName }));
      let items = (result.Items || []).filter((item) => !item.PK.startsWith("COUNTER#"));
      
      // Convert S3 URLs to presigned URLs
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
            
            return { ...item, url: urlStr };
          })
        );
      }
      
      return jsonOk({ ok: true, count: items.length, items });
    }

    // With section filter, we need to scan with filter expression
    // because our PK is now VIDEOARCHIVE#0001 format, not a direct partition key
    const result = await ddb.send(new ScanCommand({ TableName }));
    let items = (result.Items || []).filter((item) => !item.PK.startsWith("COUNTER#"));

    // Filter by section
    items = items.filter((item) => item.section === sectionFilter);

    // Filter by group if provided
    if (groupFilter) {
      items = items.filter((item) => item.group === groupFilter);
    }

    // Convert S3 URLs to presigned URLs
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
          
          return { ...item, url: urlStr };
        })
      );
    }

    return jsonOk({ ok: true, section: sectionFilter, group: groupFilter, count: items.length, items });
  } catch (e: any) {
    return jsonErr("Load failed", 500, e?.message ?? e);
  }
}

/**
 * POST - Create new item
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const body = await req.json().catch(() => null);
    if (!body) return jsonErr("Bad JSON body", 400);

    const section = String(body.section || "").trim();
    if (!section || !SECTION_PREFIX[section]) {
      return jsonErr(`Invalid section. Must be one of: ${Object.keys(SECTION_PREFIX).join(", ")}`, 400);
    }

    const url = String(body.url || "").trim();
    if (!url) return jsonErr("Missing url", 400);

    const title = String(body.title || "").trim();
    if (!title) return jsonErr("Missing title", 400);

    // Generate PK with atomic counter
    const PK = await generatePK(section);

    const item: any = {
      PK,
      url,
      section,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optional fields
    if (body.group) item.group = String(body.group).trim();
    if (body.person) item.person = String(body.person).trim();
    if (body.date) item.date = String(body.date).trim();
    if (body.description) item.description = String(body.description).trim();
    if (body.active !== undefined) item.active = Boolean(body.active);

    await ddb.send(new PutCommand({ TableName, Item: item }));

    return jsonOk({ ok: true, PK, item });
  } catch (e: any) {
    return jsonErr("Create failed", 500, e?.message ?? e);
  }
}

/**
 * PATCH - Update item (description, title, etc.)
 */
export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const body = await req.json().catch(() => null);
    if (!body) return jsonErr("Bad JSON body", 400);

    const PK = String(body.PK || "").trim();
    if (!PK) return jsonErr("Missing PK", 400);

    // Build update expression dynamically
    const updates: string[] = ["updatedAt = :upd"];
    const values: any = { ":upd": new Date().toISOString() };

    if (body.title !== undefined) {
      updates.push("title = :title");
      values[":title"] = String(body.title).trim();
    }
    if (body.description !== undefined) {
      updates.push("description = :desc");
      values[":desc"] = String(body.description).trim();
    }
    if (body.person !== undefined) {
      updates.push("person = :person");
      values[":person"] = String(body.person).trim();
    }
    if (body.date !== undefined) {
      updates.push("#dt = :date");
      values[":date"] = String(body.date).trim();
    }
    if (body.active !== undefined) {
      updates.push("active = :active");
      values[":active"] = Boolean(body.active);
    }

    const updateExpression = `SET ${updates.join(", ")}`;
    const expressionAttributeNames = body.date !== undefined ? { "#dt": "date" } : undefined;

    await ddb.send(
      new UpdateCommand({
        TableName,
        Key: { PK },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: values,
        ...(expressionAttributeNames && { ExpressionAttributeNames: expressionAttributeNames }),
      })
    );

    return jsonOk({ ok: true, PK });
  } catch (e: any) {
    return jsonErr("Update failed", 500, e?.message ?? e);
  }
}

/**
 * DELETE - Remove item
 */
export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const url = new URL(req.url);
    const PK = (url.searchParams.get("PK") || "").trim();

    if (!PK) return jsonErr("Missing PK", 400);

    await ddb.send(new DeleteCommand({ TableName, Key: { PK } }));

    return jsonOk({ ok: true });
  } catch (e: any) {
    return jsonErr("Delete failed", 500, e?.message ?? e);
  }
}