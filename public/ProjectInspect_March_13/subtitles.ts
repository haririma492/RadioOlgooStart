import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./dynamo";
import { TABLES } from "./config";

export async function listSavedSubtitleSets(limit = 5000) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: TABLES.slides,
      Limit: limit,
    })
  );

  const items = (res.Items || []) as Record<string, any>[];

  return items
    .filter((item) => {
      const pk = String(item.PK || "");
      const sk = String(item.SK || "");
      const section = String(item.section || "").toLowerCase();
      const title = String(item.title || "").toLowerCase();
      const group = String(item.group || "").toLowerCase();

      return (
        sk === "META" ||
        pk.startsWith("SUBTITLE#") ||
        section.includes("subtitle") ||
        title.includes("subtitle") ||
        group.includes("subtitle")
      );
    })
    .sort((a, b) => String(a.name || a.title || "").localeCompare(String(b.name || b.title || "")));
}