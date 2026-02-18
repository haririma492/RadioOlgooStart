// app/api/admin/create-group/route.ts
// 
// Allows creating:
// - a new SECTION (group can be empty or omitted)
// - a new GROUP under an existing section
//
// Uses DynamoDB to store markers for sections/groups
// PK format:
// - SECTION#<section-name>
// - GROUP#<section-name>#<group-name>
//
// Returns 200 even if already exists (idempotent)
//
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token")?.trim();
  const expected = process.env.ADMIN_TOKEN?.trim();
  return !!expected && token === expected;
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  if (!checkAuth(req)) {
    console.log("Unauthorized request to create-group");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { section, group } = body;

    // Normalize inputs
    section = (section || "").trim();
    group   = (group   || "").trim();

    // Validation
    if (!section) {
      console.log("Missing section name");
      return NextResponse.json({ error: "Section name is required" }, { status: 400 });
    }

    const TableName = getEnv("DDB_TABLE_NAME");
    const now = new Date().toISOString();

    // Decide PK and type
    let PK: string;
    let type: string;
    let message: string;

    if (group) {
      PK = `GROUP#${section}#${group}`;
      type = "group";
      message = `Group "${group}" in section "${section}"`;
    } else {
      PK = `SECTION#${section}`;
      type = "section";
      message = `Section "${section}"`;
    }

    console.log(`Attempting to create: ${type} - PK: ${PK}`);

    // Check if already exists (optional but helpful for logging)
    const existing = await ddb.send(new GetCommand({ TableName, Key: { PK } }));

    if (existing.Item) {
      console.log(`${type} already exists: ${PK}`);
      return NextResponse.json({
        success: true,
        message: `${message} already exists (no change made)`,
        section,
        group: group || null,
        existed: true,
      });
    }

    // Create new item
    const Item = {
      PK,
      section: section,
      group: group || null,
      type,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName,
        Item,
        // No condition — we already checked manually
      })
    );

    console.log(`Successfully created ${type}: ${PK}`);

    return NextResponse.json({
      success: true,
      message: `${message} created successfully`,
      section,
      group: group || null,
      existed: false,
    });

  } catch (e: any) {
    console.error("Create-group error:", e);

    if (e.name === "ConditionalCheckFailedException") {
      // Shouldn't reach here after manual check, but just in case
      return NextResponse.json({
        success: true,
        message: "Item already exists",
      });
    }

    return NextResponse.json(
      { error: e.message || "Server error", detail: e.stack || String(e) },
      { status: 500 }
    );
  }
}