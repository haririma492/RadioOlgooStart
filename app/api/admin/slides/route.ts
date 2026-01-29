import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

function requireAdmin(req: Request) {
  const token = (req.headers.get("x-admin-token") || "").trim();
  return !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

const region = process.env.AWS_REGION!;
const tableName = process.env.DDB_TABLE_NAME!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

type SetKind = "CENTER" | "BG";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
  // List slides in a set (admin usage). Requires token.
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const set = url.searchParams.get("set") as SetKind | null;
  if (!set || (set !== "CENTER" && set !== "BG")) {
    return badRequest("Missing/invalid set. Use ?set=CENTER or ?set=BG");
  }

  try {
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": set },
      })
    );

    const items = (out.Items || []).map((it: any) => ({
      pk: it.pk,
      sk: it.sk,
      url: it.url,
      mediaType: it.mediaType || (it.pk === "CENTER" ? "video/mp4" : "image/jpeg"),
      category1: it.category1 ?? "",
      category2: it.category2 ?? "",
      description: it.description ?? "",
      enabled: !!it.enabled,
      order: Number(it.order ?? 0),
      createdAt: it.createdAt,
    }));

    // Sort nicely for UI
    items.sort((a, b) => (a.order - b.order) || String(a.sk).localeCompare(String(b.sk)));

    return NextResponse.json({ ok: true, set, items });
  } catch (e: any) {
    return NextResponse.json(
      { error: "DDB read failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Add a slide/media record (admin usage). Requires token.
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      set: SetKind;
      url: string;
      order?: number;
      enabled?: boolean;
      mediaType?: string;     // "video/mp4" for CENTER, "image/jpeg" etc for BG
      category1?: string;     // new
      category2?: string;     // new
      description?: string;   // new
    };

    const set = body?.set;
    const mediaUrl = (body?.url || "").trim();

    if (!set || (set !== "CENTER" && set !== "BG")) return badRequest("Invalid set. Must be CENTER or BG");
    if (!mediaUrl) return badRequest("Missing url");

    const mediaType =
      (body?.mediaType || "").trim() ||
      (set === "CENTER" ? "video/mp4" : "image/jpeg");

    // Give CENTER its own key prefix so it’s clear these are videos now
    const skPrefix = set === "CENTER" ? "VID" : "IMG";
    const sk = `${skPrefix}#${Date.now()}#${Math.random().toString(16).slice(2)}`;

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: set,
          sk,
          url: mediaUrl,
          mediaType,
          category1: (body.category1 || "").trim(),
          category2: (body.category2 || "").trim(),
          description: (body.description || "").trim(),
          enabled: typeof body.enabled === "boolean" ? body.enabled : true,
          order: typeof body.order === "number" ? body.order : 0,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ ok: true, pk: set, sk }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "DDB write failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  // Delete a slide/media record by pk+sk (admin usage). Requires token.
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const set = url.searchParams.get("set") as SetKind | null;
  const sk = url.searchParams.get("sk");

  if (!set || (set !== "CENTER" && set !== "BG")) return badRequest("Missing/invalid set. Use ?set=CENTER or ?set=BG");
  if (!sk) return badRequest("Missing sk. Use ?sk=IMG#... or ?sk=VID#...");

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk: set, sk },
      })
    );

    return NextResponse.json({ ok: true, deleted: { pk: set, sk } });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Delete failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
