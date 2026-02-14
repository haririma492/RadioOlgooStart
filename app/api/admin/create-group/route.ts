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
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION || "ca-central-1";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { section, group } = body;

    // Normalize
    section = (section || "").trim();
    group   = (group   || "").trim();

    // Validation
    if (!section) {
      return NextResponse.json(
        { error: "Section name is required" },
        { status: 400 }
      );
    }

    const TableName = getEnv("DDB_TABLE_NAME");
    const now = new Date().toISOString();

    // Decide what to create
    let PK: string;
    let Item: any;

    if (group) {
      // Create GROUP under SECTION
      PK = `GROUP#${section}#${group}`;
      Item = {
        PK,
        section,
        group,
        type: "group",
        createdAt: now,
        updatedAt: now,
      };
    } else {
      // Create SECTION (no group needed)
      PK = `SECTION#${section}`;
      Item = {
        PK,
        section,
        type: "section",
        createdAt: now,
        updatedAt: now,
      };
    }

    // Write to DynamoDB
    await ddb.send(
      new PutCommand({
        TableName,
        Item,
        ConditionExpression: "attribute_not_exists(PK)", // prevent overwrite
      })
    );

    return NextResponse.json({
      success: true,
      message: group ? `Group "${group}" created in section "${section}"` : `Section "${section}" created`,
      section,
      group: group || null,
    });
  } catch (e: any) {
    console.error("Create-group error:", e);

    if (e.name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { error: "This section or group already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Server error", detail: e.message || String(e) },
      { status: 500 }
    );
  }
}