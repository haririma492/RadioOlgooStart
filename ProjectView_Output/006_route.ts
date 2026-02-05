// Original: app\api\admin\slides\route.ts
// app/api/admin/slides/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetSet = "CENTER" | "SLIDES" | "BG";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in env`);
  return v;
}

function requireAdmin(req: Request) {
  const incoming = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) throw new Error("Missing ADMIN_TOKEN in env");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function parseSet(raw: string | null): TargetSet | null {
  const s = (raw || "").trim().toUpperCase();
  if (s === "CENTER" || s === "SLIDES" || s === "BG") return s as TargetSet;
  return null;
}

function skPrefixFor(set: TargetSet) {
  if (set === "CENTER") return "VID#";
  if (set === "SLIDES") return "SLD#";
  return "BG#";
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
    region:
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "ca-central-1",
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

function tableName() {
  const v = (process.env.DDB_TABLE_NAME || "").trim();
  if (!v) throw new Error("Missing DDB_TABLE_NAME in env");
  return v;
}


async function listBySet(set: TargetSet) {
  const TableName = tableName();
  if (!TableName) throw new Error("Missing DDB table name env (DDB_TABLE_NAME)");

  const out = await ddb.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": set },
    })
  );

  const items = (out.Items || []) as any[];
  items.sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
  return items;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const url = new URL(req.url);
    const set = parseSet(url.searchParams.get("set"));
    if (!set) return jsonErr("Invalid set. Must be CENTER, SLIDES, or BG", 400);

    const items = await listBySet(set);
    return jsonOk({ ok: true, set, count: items.length, items });
  } catch (e: any) {
    return jsonErr("Load failed", 500, e?.message ?? e);
  }
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    if (!TableName) throw new Error("Missing DDB table name env (DDB_TABLE_NAME)");

    const body = await req.json().catch(() => null);
    if (!body) return jsonErr("Bad JSON body", 400);

    const set = parseSet(body.set);
    if (!set) return jsonErr("Invalid set. Must be CENTER, SLIDES, or BG", 400);

    const urlStr = String(body.url || "").trim();
    if (!urlStr) return jsonErr("Missing url", 400);

    const mediaType = String(body.mediaType || "").trim();

    const incomingSk = String(body.sk || "").trim();
    const ts = Date.now();
    const id = randomUUID().replace(/-/g, "").slice(0, 14);
    const sk = incomingSk || `${skPrefixFor(set)}${ts}#${id}`;

    const item = {
      pk: set,
      sk,
      url: urlStr,
      mediaType,
      enabled: body.enabled ?? true,
      order: Number(body.order ?? 0),
      category1: String(body.category1 || ""),
      category2: String(body.category2 || ""),
      description: String(body.description || ""),
      createdAt: String(body.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName, Item: item }));

    return jsonOk({ ok: true, pk: set, sk });
  } catch (e: any) {
    return jsonErr("DDB write failed", 500, e?.message ?? e);
  }
}

export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const TableName = tableName();
    if (!TableName) throw new Error("Missing DDB table name env (DDB_TABLE_NAME)");

    const url = new URL(req.url);
    const set = parseSet(url.searchParams.get("set"));
    const sk = (url.searchParams.get("sk") || "").trim();

    if (!set) return jsonErr("Invalid set. Must be CENTER, SLIDES, or BG", 400);
    if (!sk) return jsonErr("Missing sk", 400);

    await ddb.send(new DeleteCommand({ TableName, Key: { pk: set, sk } }));

    return jsonOk({ ok: true });
  } catch (e: any) {
    return jsonErr("Delete failed", 500, e?.message ?? e);
  }
}
