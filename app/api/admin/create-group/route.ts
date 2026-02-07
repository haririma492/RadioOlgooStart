// app/api/admin/create-group/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DDB_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error("DDB_TABLE_NAME is not set in environment variables");
}

export async function POST(req: Request) {
  const authToken = req.headers.get("x-admin-token");
  if (!authToken || authToken !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { section, group } = body;

    if (!section?.trim() || !group?.trim()) {
      return NextResponse.json({ error: "Section and group name are required" }, { status: 400 });
    }

    const cleanSection = section.trim();
    const cleanGroup = group.trim();

    // Create a placeholder item to register the group
    const dummyPK = `GROUP-REG#${Date.now()}-${randomUUID().slice(0, 8)}`;

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: dummyPK,
          section: cleanSection,
          group: cleanGroup,
          title: `Placeholder for group: ${cleanGroup}`,
          url: "placeholder://no-media",
          createdAt: new Date().toISOString(),
          isPlaceholder: true, // optional flag to identify later
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: `Group "${cleanGroup}" created in section "${cleanSection}"`,
    });
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}