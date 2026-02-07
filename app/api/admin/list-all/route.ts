// app/api/admin/list-all/route.ts
// Returns ALL items from DynamoDB in raw format (no S3 presigning)
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

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
  const v = (process.env.DDB_TABLE_NAME || "").trim();
  if (!v) throw new Error("Missing DDB_TABLE_NAME in env");
  return v;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();

    // Scan entire table (no filters)
    const result = await ddb.send(new ScanCommand({ TableName }));
    const items = result.Items || [];

    // Sort by createdAt descending (newest first)
    items.sort((a, b) => {
      const da = a.createdAt || "";
      const db = b.createdAt || "";
      return db.localeCompare(da);
    });

    return NextResponse.json(
      { ok: true, count: items.length, items },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load items", detail: e?.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    const body = await req.json().catch(() => null);
    
    if (!body || !Array.isArray(body.pks)) {
      return NextResponse.json(
        { error: "Body must include { pks: string[] }" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const pks = body.pks.filter((pk: any) => typeof pk === "string" && pk.trim());
    
    if (pks.length === 0) {
      return NextResponse.json(
        { error: "No valid PKs provided" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Import DeleteCommand
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");

    // Delete each item
    const deleted: string[] = [];
    const failed: { pk: string; error: string }[] = [];

    for (const pk of pks) {
      try {
        await ddb.send(
          new DeleteCommand({
            TableName,
            Key: { PK: pk },
          })
        );
        deleted.push(pk);
      } catch (err: any) {
        failed.push({ pk, error: err.message || String(err) });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        deleted: deleted.length,
        failed: failed.length,
        deletedPKs: deleted,
        failedItems: failed,
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Delete failed", detail: e?.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}