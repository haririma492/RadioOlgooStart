import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./dynamo";
import { TABLES } from "./config";

function inferSourceType(item: Record<string, any>) {
  const url = String(item.url || "").toLowerCase();
  const section = String(item.section || "").toLowerCase();
  const description = String(item.description || "").toLowerCase();

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    if (url.includes("live") || item.isLive === true) return "youtube_live";
    return "youtube_embed";
  }
  if (url.endsWith(".m3u8")) return "hls_stream";
  if (url.endsWith(".mp4") && (url.includes("s3.") || url.includes("amazonaws.com"))) return "s3_mp4";
  if (url.endsWith(".mp3") && (url.includes("s3.") || url.includes("amazonaws.com"))) return "s3_mp3";
  if (section.includes("youtube channel videos")) {
    if (url.endsWith(".mp4")) return "s3_mp4";
    return "youtube_archive";
  }
  if (url.startsWith("http")) return "external_stream";
  if (description.includes("live")) return "youtube_live";
  return "unknown";
}

function inferMediaType(item: Record<string, any>, sourceType: string) {
  const url = String(item.url || "").toLowerCase();
  if (url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".png") || url.endsWith(".webp") || url.endsWith(".gif")) return "image";
  if (["youtube_live", "youtube_embed", "s3_mp4", "hls_stream"].includes(sourceType)) return "video";
  if (["s3_mp3"].includes(sourceType)) return "audio";
  if (url.endsWith(".mp4") || url.endsWith(".m3u8")) return "video";
  if (url.endsWith(".mp3")) return "audio";
  return "video";
}

export async function listSlides(limit = 500) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: TABLES.slides,
      Limit: limit,
    })
  );

  const items = (res.Items || []).map((item) => {
    const sourceType = item.sourceType || inferSourceType(item);
    const mediaType = item.mediaType || inferMediaType(item, sourceType);
    return {
      PK: item.PK,
      title: item.title || "",
      section: item.section || "",
      group: item.group || "",
      person: item.person || "",
      url: item.url || "",
      sourceType,
      mediaType,
      status: item.status || "",
      durationSec: item.durationSec || item.duration || 1800,
    };
  });

  items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  return items;
}