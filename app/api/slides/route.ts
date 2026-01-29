import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

type SetKind = "CENTER" | "BG";

const region = process.env.AWS_REGION!;
const tableName = process.env.DDB_TABLE_NAME!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const set = (url.searchParams.get("set") || "").toUpperCase() as SetKind;

    if (set !== "CENTER" && set !== "BG") {
      return NextResponse.json(
        { error: "Invalid set. Use ?set=CENTER or ?set=BG" },
        { status: 400 }
      );
    }

    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": set },
      })
    );

    const items = (out.Items || []).sort((a: any, b: any) => {
      const ao = typeof a.order === "number" ? a.order : 0;
      const bo = typeof b.order === "number" ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });

    return NextResponse.json({ ok: true, set, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load slides", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
