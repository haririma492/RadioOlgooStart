// app/api/admin/content/route.ts
// API route for managing website content (headers, sections, groups, footers)
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) throw new Error("Missing ADMIN_TOKEN in env");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "ca-central-1",
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

function tableName() {
  const v = (process.env.CONTENT_TABLE_NAME || "").trim();
  if (!v) throw new Error("Missing CONTENT_TABLE_NAME in env");
  return v;
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

/**
 * GET - List all content items
 */
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const result = await ddb.send(new ScanCommand({ TableName }));
    const items = result.Items || [];

    // Sort by PK for consistent ordering
    items.sort((a, b) => String(a.PK).localeCompare(String(b.PK)));

    return jsonOk({ ok: true, count: items.length, items });
  } catch (e: any) {
    return jsonErr("Failed to load content", 500, e?.message);
  }
}

/**
 * POST - Create or update content item
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const body = await req.json().catch(() => null);
    if (!body) return jsonErr("Bad JSON body", 400);

    const PK = String(body.PK || "").trim();
    if (!PK) return jsonErr("Missing PK", 400);

    const type = String(body.type || "").trim();
    if (!type) return jsonErr("Missing type", 400);

    const text = String(body.text || "").trim();
    if (!text) return jsonErr("Missing text", 400);

    const item: any = {
      PK,
      type,
      text,
      fontFamily: String(body.fontFamily || "Arial, sans-serif"),
      fontSize: String(body.fontSize || "16px"),
      fontWeight: String(body.fontWeight || "normal"),
      color: String(body.color || "#000000"),
      textAlign: String(body.textAlign || "left"),
      backgroundColor: String(body.backgroundColor || "transparent"),
      padding: String(body.padding || "0px"),
      order: Number(body.order || 0),
      active: body.active !== undefined ? Boolean(body.active) : true,
      updatedAt: new Date().toISOString(),
    };

    // Add type-specific fields
    if (type === "header" || type === "footer") {
      item.level = Number(body.level || 1);
    }
    if (type === "section_header") {
      item.sectionId = Number(body.sectionId || 0);
    }
    if (type === "group_title") {
      item.sectionId = Number(body.sectionId || 0);
      item.groupId = Number(body.groupId || 0);
    }

    await ddb.send(new PutCommand({ TableName, Item: item }));

    return jsonOk({ ok: true, PK, item });
  } catch (e: any) {
    return jsonErr("Create/update failed", 500, e?.message);
  }
}

/**
 * DELETE - Remove content item
 */
export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.pks)) {
      return jsonErr("Body must include { pks: string[] }", 400);
    }

    const pks = body.pks.filter((pk: any) => typeof pk === "string" && pk.trim());
    if (pks.length === 0) {
      return jsonErr("No valid PKs provided", 400);
    }

    const deleted: string[] = [];
    const failed: { pk: string; error: string }[] = [];

    for (const pk of pks) {
      try {
        await ddb.send(new DeleteCommand({ TableName, Key: { PK: pk } }));
        deleted.push(pk);
      } catch (err: any) {
        failed.push({ pk, error: err.message || String(err) });
      }
    }

    return jsonOk({
      ok: true,
      deleted: deleted.length,
      failed: failed.length,
      deletedPKs: deleted,
      failedItems: failed,
    });
  } catch (e: any) {
    return jsonErr("Delete failed", 500, e?.message);
  }
}