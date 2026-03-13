import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "./dynamo";
import { TABLES } from "./config";

export async function listSavedSubtitleSets() {
  const res = await ddbDoc.send(
    new ScanCommand({
      TableName: TABLES.subtitles,
      Limit: 5000,
    })
  );

  const items = res.Items || [];
  return items
    .filter((item) => item.SK === "META" && String(item.PK || "").startsWith("SUBTITLE#"))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
