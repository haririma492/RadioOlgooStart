// app/api/live-videos/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ca-central-1";

const TABLE_NAME =
  process.env.DDB_TABLE_NAME ||
  process.env.DYNAMODB_TABLE ||
  process.env.TABLE_NAME;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

function norm(s: any): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isActive(val: any): boolean {
  if (val === undefined || val === null) return true; // default active
  if (val === true) return true;
  if (val === false) return false;
  const s = norm(val);
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

// “Revolution TV/Channels” matching that survives small differences
function groupMatches(groupValue: any, wantedGroup?: string): boolean {
  const g = norm(groupValue);
  if (!g) return false;

  // If caller provided group query param, try exact normalized match first
  if (wantedGroup) {
    const w = norm(wantedGroup);
    if (g === w) return true;
  }

  // Fallback: accept common variations
  // Must include "revolution" and (tv or channel)
  const hasRevolution = g.includes("revolution");
  const hasTv = g.includes("tv");
  const hasChannel = g.includes("channel");
  return hasRevolution && (hasTv || hasChannel);
}

export async function GET(req: Request) {
  if (!TABLE_NAME) {
    return NextResponse.json(
      { error: "Server missing DDB table env var (DDB_TABLE_NAME / DYNAMODB_TABLE / TABLE_NAME)." },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const wantedGroup = (url.searchParams.get("group") || "Revolution TV/Channels").trim();

  try {
    const all: any[] = [];
    let lastKey: any = undefined;

    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          ExclusiveStartKey: lastKey,
        })
      );
      if (out.Items?.length) all.push(...out.Items);
      lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    // Filter in Node with normalization so casing/spaces/types won’t break it
    const filtered = all.filter((it) => {
      const sec = norm(it?.section);
      const grp = it?.group;

      const sectionOk = sec === "live videos" || sec === "live video" || sec === "live";
      const groupOk = groupMatches(grp, wantedGroup);
      const activeOk = isActive(it?.active);
      const hasUrl = Boolean(String(it?.url ?? "").trim());

      return sectionOk && groupOk && activeOk && hasUrl;
    });

    const items = filtered.map((it) => ({
      PK: it.PK,
      url: it.url,
      title: it.title || it.person || it.PK,
      person: it.person,
      group: it.group,
      section: it.section,
      active: it.active ?? true,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    return NextResponse.json({
      items,
      debug: {
        totalScanned: all.length,
        matched: items.length,
        wantedGroup,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load Live Videos." },
      { status: 500 }
    );
  }
}
