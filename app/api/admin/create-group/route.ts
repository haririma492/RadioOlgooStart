// app/api/admin/create-group/route.ts
// API route to create a new group (registers it with a placeholder item)

import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

// Force Node.js runtime (longer timeouts, better for DynamoDB)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initialize DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Must be set in Vercel environment variables
const TABLE_NAME = process.env.DDB_TABLE_NAME;

if (!TABLE_NAME) {
  console.error("Missing DDB_TABLE_NAME environment variable");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*", // Change to your frontend domain in production
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: Request) {
  // Handle CORS preflight in production
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      },
    });
  }

  // Simple admin token check (match your existing auth pattern)
  const authToken = request.headers.get("x-admin-token");
  if (!authToken || authToken !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { section, group } = body;

    if (!section?.trim() || !group?.trim()) {
      return NextResponse.json({ error: "Section and group name are required" }, { status: 400 });
    }

    const cleanSection = section.trim();
    const cleanGroup = group.trim();

    // Generate a unique PK that matches your media item format
    const dummyPK = `MEDIA#GROUP-REG-${Date.now()}-${randomUUID().slice(0, 8)}`;

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: dummyPK,
          url: "placeholder://group-registration",
          section: cleanSection,
          title: `Placeholder - Group: ${cleanGroup}`,
          group: cleanGroup,
          createdAt: new Date().toISOString(),
          isPlaceholder: true, // optional flag for future cleanup
        },
      })
    );

    return NextResponse.json(
      {
        success: true,
        message: `Group "${cleanGroup}" created in section "${cleanSection}"`,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*", // adjust in production
        },
      }
    );
  } catch (error: any) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Failed to create group", details: error.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}