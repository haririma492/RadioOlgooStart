import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs"; // IMPORTANT: AWS SDK needs node runtime (not edge)

// ---- Env / Config ----
const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ca-central-1";

const TABLE_NAME =
  process.env.DDB_TABLE_NAME ||
  process.env.DYNAMODB_TABLE ||
  process.env.TABLE_NAME;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ---- DynamoDB client ----
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  {
    marshallOptions: { removeUndefinedValues: true },
  }
);

function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN) {
    return { ok: false, error: "Server missing ADMIN_TOKEN env var." };
  }
  if (token !== ADMIN_TOKEN) {
    return { ok: false, error: "Invalid admin token." };
  }
  if (!TABLE_NAME) {
    return { ok: false, error: "Server missing DynamoDB table env var (DDB_TABLE_NAME)." };
  }
  return { ok: true, token };
}

// ---- GET: list all items (media table) ----
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    // NOTE: Scan can be expensive. Works fine for small tables.
    // If you have a PK prefix pattern (MEDIA#...), you can filter later.
    const items: any[] = [];
    let lastKey: any = undefined;

    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: TABLE_NAME!,
          ExclusiveStartKey: lastKey,
        })
      );
      if (out.Items?.length) items.push(...out.Items);
      lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to list items." },
      { status: 500 }
    );
  }
}

// ---- DELETE: batch delete by PK list ----
export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const pks: string[] = Array.isArray(body?.pks) ? body.pks : [];

    if (pks.length === 0) {
      return NextResponse.json({ error: "No PKs provided." }, { status: 400 });
    }

    let deleted = 0;
    for (const pk of pks) {
      if (!pk || typeof pk !== "string") continue;
      await ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME!,
          Key: { PK: pk },
        })
      );
      deleted += 1;
    }

    return NextResponse.json({ deleted });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed." },
      { status: 500 }
    );
  }
}

// ---- POST: upsert a single item (create/update) ----
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const item = await req.json();

    const pk = String(item?.PK || "").trim();
    if (!pk) {
      return NextResponse.json({ error: "PK is required." }, { status: 400 });
    }

    // Minimal validation for media records (adjust as you like)
    // We allow any shape, but enforce PK and update timestamps.
    const now = new Date().toISOString();

    const putItem = {
      ...item,
      PK: pk,
      updatedAt: now,
      createdAt: item?.createdAt || now,
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME!,
        Item: putItem,
      })
    );

    return NextResponse.json({ ok: true, PK: pk });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Save failed." },
      { status: 500 }
    );
  }
}
