// app/api/admin/groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// ✅ Force dynamic (prevents Next from caching at the route level)
export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "ca-central-1";
const TABLE = process.env.DDB_TABLE_NAME || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// If you have a GSI for section -> groups, set it here.
// Example: "GSI1" where partition key is "section" and sort key is "group".
const GROUPS_GSI_NAME = process.env.GROUPS_GSI_NAME || ""; // optional

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  {
    marshallOptions: { removeUndefinedValues: true },
  }
);

function noStoreJson(data: any, init?: number) {
  return new NextResponse(JSON.stringify(data), {
    status: init ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function requireAdmin(req: NextRequest): NextResponse | null {
  // You can also accept Authorization: Bearer xxx if you prefer.
  const token = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return noStoreJson({ ok: false, error: "Unauthorized" }, 401);
  }
  return null;
}

/**
 * Data model assumption (simple + common):
 * - pk: "GROUP#<section>"
 * - sk: "GROUP#<group>"
 * - section: string
 * - group: string
 * - type: "group"
 * - createdAt: ISO string
 *
 * If your table is different, tell me your PK/SK pattern and I’ll adapt it.
 */
function makeKeys(section: string, group: string) {
  const sec = section.trim();
  const grp = group.trim();
  return {
    pk: `GROUP#${sec}`,
    sk: `GROUP#${grp}`,
    section: sec,
    group: grp,
    type: "group",
  };
}

export async function GET(req: NextRequest) {
  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  if (!TABLE) return noStoreJson({ ok: false, error: "Missing DDB_TABLE_NAME" }, 500);

  const { searchParams } = new URL(req.url);
  const section = (searchParams.get("section") || "").trim();

  if (!section) {
    return noStoreJson({ ok: false, error: "Missing ?section=" }, 400);
  }

  // ✅ Always return ALL items (no Limit=6 bug), with pagination loop.
  const items: any[] = [];
  let lastKey: any | undefined = undefined;

  // Strategy:
  // 1) If you have a GSI for section, use it (faster in large tables).
  // 2) Otherwise query the pk = GROUP#<section> (best).
  // 3) If your table doesn’t have those keys, fallback to Scan with filter (slow).
  try {
    // Best case: query by PK pattern shown above
    do {
      const out = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skPrefix)",
          ExpressionAttributeNames: {
            "#pk": "pk",
            "#sk": "sk",
          },
          ExpressionAttributeValues: {
            ":pk": `GROUP#${section}`,
            ":skPrefix": "GROUP#",
          },
          ExclusiveStartKey: lastKey,
        })
      );

      if (out.Items?.length) items.push(...out.Items);
      lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    // Sort alphabetically (Persian/Arabic sorts depend on locale; this is simple)
    const groups = items
      .map((x) => x.group)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));

    return noStoreJson({ ok: true, section, total: groups.length, groups });
  } catch (e) {
    // Optional: if your PK/SK model differs, you can use a GSI
    // or fallback to Scan. We do fallback scan here to keep it working.
    console.error("GET /api/admin/groups query failed, falling back to scan:", e);

    const scanItems: any[] = [];
    let scanLastKey: any | undefined = undefined;

    try {
      do {
        const out = await ddb.send(
          new ScanCommand({
            TableName: TABLE,
            FilterExpression: "#type = :t AND #section = :s",
            ExpressionAttributeNames: {
              "#type": "type",
              "#section": "section",
            },
            ExpressionAttributeValues: {
              ":t": "group",
              ":s": section,
            },
            ExclusiveStartKey: scanLastKey,
          })
        );
        if (out.Items?.length) scanItems.push(...out.Items);
        scanLastKey = out.LastEvaluatedKey;
      } while (scanLastKey);

      const groups = scanItems
        .map((x) => x.group)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)));

      return noStoreJson({ ok: true, section, total: groups.length, groups });
    } catch (scanErr) {
      console.error("GET /api/admin/groups scan failed:", scanErr);
      return noStoreJson({ ok: false, error: "Failed to load groups" }, 500);
    }
  }
}

export async function POST(req: NextRequest) {
  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  if (!TABLE) return noStoreJson({ ok: false, error: "Missing DDB_TABLE_NAME" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const section = String(body?.section || "").trim();
  const group = String(body?.group || "").trim();

  if (!section || !group) {
    return noStoreJson({ ok: false, error: "Body must include { section, group }" }, 400);
  }

  const now = new Date().toISOString();
  const item = {
    ...makeKeys(section, group),
    createdAt: now,
    updatedAt: now,
    active: true,
  };

  try {
    // ✅ Prevent duplicates (same pk+sk)
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
        },
      })
    );

    return noStoreJson({ ok: true, created: true, section, group });
  } catch (e: any) {
    // If already exists, return ok but created=false
    if (e?.name === "ConditionalCheckFailedException") {
      return noStoreJson({ ok: true, created: false, section, group, note: "Already exists" });
    }
    console.error("POST /api/admin/groups failed:", e);
    return noStoreJson({ ok: false, error: "Failed to create group" }, 500);
  }
}
