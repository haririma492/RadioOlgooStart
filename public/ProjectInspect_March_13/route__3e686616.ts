// app/api/admin/migrate-old/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetSet = "CENTER" | "SLIDES" | "BG";

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) throw new Error("Missing ADMIN_TOKEN in env");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function tableName() {
  return (
    process.env.DDB_TABLE_NAME ||
    process.env.MEDIA_TABLE_NAME ||
    process.env.TABLE_NAME ||
    ""
  ).trim();
}

const NEW_CATEGORIES = new Set(["YouTubeChannels", "RevolutionMusic", "Old"]);

/**
 * POST /api/admin/migrate-old
 * Purpose: tag legacy items (missing category1/category2) under:
 *   category1="Old"
 *   category2 = pk ("CENTER" | "SLIDES" | "BG")
 *
 * Safety: by default it updates ONLY items where category1 is empty.
 * If you want to force retag everything (NOT recommended), set env MIGRATE_FORCE=1 temporarily.
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    if (!TableName) throw new Error("Missing DDB table name env (DDB_TABLE_NAME)");

    const force = (process.env.MIGRATE_FORCE || "").trim() === "1";

    const ddb = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1",
      })
    );

    let scanned = 0;
    let updated = 0;
    let lastKey: any = undefined;

    do {
      const scan = await ddb.send(
        new ScanCommand({
          TableName,
          ExclusiveStartKey: lastKey,
        })
      );

      const items = (scan.Items || []) as any[];
      scanned += items.length;
      lastKey = scan.LastEvaluatedKey;

      for (const it of items) {
        const pk = String(it.pk || "").trim().toUpperCase() as TargetSet;
        const sk = String(it.sk || "").trim();

        if (!(pk === "CENTER" || pk === "SLIDES" || pk === "BG")) continue;
        if (!sk) continue;

        const c1 = String(it.category1 || "").trim();
        const c2 = String(it.category2 || "").trim();

        // Default: only touch legacy/empty category1
        if (!force) {
          if (c1) continue; // already categorized
        }

        // If force, still avoid smashing new categories unless explicitly desired
        if (force && c1 && NEW_CATEGORIES.has(c1)) {
          // keep as-is
          continue;
        }

        await ddb.send(
          new UpdateCommand({
            TableName,
            Key: { pk: pk, sk: sk },
            UpdateExpression: "SET category1 = :c1, category2 = :c2",
            ExpressionAttributeValues: {
              ":c1": "Old",
              ":c2": pk, // CENTER / SLIDES / BG
            },
          })
        );

        updated += 1;
      }
    } while (lastKey);

    return NextResponse.json({ ok: true, scanned, updated });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Migration failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
