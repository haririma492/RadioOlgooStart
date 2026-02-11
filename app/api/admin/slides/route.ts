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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || "ca-central-1";
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } }
);

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
// GET /api/admin/slides - List all items (admin view)
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

    // Sort by createdAt descending (newest first)
    items.sort((a: any, b: any) => {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      return dateB.localeCompare(dateA);
    });

    return json({ ok: true, items, count: items.length });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/admin/slides - Create new item
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const { url, section, title, group, person, date, description } = body;

    if (!url || !section || !title) {
      return json({ error: "Missing required fields: url, section, title" }, 400);
    }

    const TableName = getEnv("DDB_TABLE_NAME");
    
    // Generate PK
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
      date: date || new Date().toISOString().split("T")[0], // Default to today if not provided
      description: description || "",
      active: true,
      createdAt: now,  // ✅ Set creation timestamp
      updatedAt: now,  // ✅ Set update timestamp
    };

    await ddb.send(new PutCommand({ TableName, Item }));

    return json({ ok: true, PK, title });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/admin/slides - Update existing item
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

    // ✅ CRITICAL: Get existing item to preserve createdAt
    const existingResult = await ddb.send(
      new GetCommand({
        TableName,
        Key: { PK },
      })
    );

    const existingItem = existingResult.Item;
    if (!existingItem) {
      return json({ error: "Item not found" }, 404);
    }

    // ✅ Build update with proper date handling
    const updatedItem: any = {
      ...otherFields,
      PK,
      date: date || existingItem.date || new Date().toISOString().split("T")[0], // Use provided date, or existing, or today
      createdAt: existingItem.createdAt || new Date().toISOString(), // ✅ PRESERVE original creation time
      updatedAt: new Date().toISOString(), // ✅ SET to current time
    };

    await ddb.send(new PutCommand({ TableName, Item: updatedItem }));

    return json({ ok: true, PK });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/admin/slides?PK=xxx - Delete item
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
    await ddb.send(new DeleteCommand({ TableName, Key: { PK } }));

    return json({ ok: true, PK });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}