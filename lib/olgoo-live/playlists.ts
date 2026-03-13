import {
  PLAYLIST_TABLE_NAME,
  deleteItem,
  ensurePkSkTable,
  nowIso,
  queryByPk,
  scanTable,
  slugifyName,
  putItem,
  tableExists,
} from "./dynamo";
import type { PlaylistItem, PlaylistMeta, PlaylistRecord } from "./types";

function inferSourceType(url: string): string {
  const lower = (url || "").toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube_embed";
  if (lower.endsWith(".m3u8")) return "hls_stream";
  if (lower.endsWith(".mp3")) return "s3_mp3";
  if (lower.endsWith(".mp4")) return "s3_mp4";
  return "external_stream";
}

function inferMediaType(url: string): string {
  const lower = (url || "").toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) return "image";
  if (lower.endsWith(".mp3")) return "audio";
  return "video";
}

export async function listPlaylists(): Promise<PlaylistMeta[]> {
  const exists = await tableExists(PLAYLIST_TABLE_NAME);
  if (!exists) {
    return [];
  }

  const rows = await scanTable(PLAYLIST_TABLE_NAME, 5000);

  return rows
    .filter((row) => row.SK === "META" && String(row.PK || "").startsWith("PLAYLIST#"))
    .map((row) => ({
      playlistId: String(row.playlistId || ""),
      name: String(row.name || row.playlistId || ""),
      itemCount: Number(row.itemCount || 0),
      totalDurationSec: Number(row.totalDurationSec || 0),
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPlaylist(playlistId: string): Promise<PlaylistRecord | null> {
  const exists = await tableExists(PLAYLIST_TABLE_NAME);
  if (!exists) {
    return null;
  }

  const rows = await queryByPk(PLAYLIST_TABLE_NAME, `PLAYLIST#${playlistId}`);
  if (!rows.length) return null;

  const meta = rows.find((row) => row.SK === "META");
  const items = rows
    .filter((row) => String(row.SK || "").startsWith("ITEM#"))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((row) => ({
      assetPk: row.assetPk ? String(row.assetPk) : undefined,
      title: String(row.title || ""),
      url: String(row.url || ""),
      durationSec: Number(row.durationSec || 0),
      sourceType: row.sourceType ? String(row.sourceType) : undefined,
      mediaType: row.mediaType ? String(row.mediaType) : undefined,
    } as PlaylistItem));

  return {
    playlistId,
    name: String(meta?.name || playlistId),
    itemCount: Number(meta?.itemCount || items.length),
    totalDurationSec: Number(
      meta?.totalDurationSec || items.reduce((sum, item) => sum + item.durationSec, 0)
    ),
    createdAt: meta?.createdAt ? String(meta.createdAt) : undefined,
    updatedAt: meta?.updatedAt ? String(meta.updatedAt) : undefined,
    items,
  };
}

export async function savePlaylist(input: {
  name: string;
  items: PlaylistItem[];
}): Promise<PlaylistRecord> {
  await ensurePkSkTable(PLAYLIST_TABLE_NAME);

  const playlistId = slugifyName(input.name);
  const pk = `PLAYLIST#${playlistId}`;
  const existing = await queryByPk(PLAYLIST_TABLE_NAME, pk);

  for (const row of existing) {
    await deleteItem(PLAYLIST_TABLE_NAME, { PK: pk, SK: row.SK });
  }

  const timestamp = nowIso();

  const normalizedItems = input.items.map((item, index) => ({
    assetPk: item.assetPk || `MANUAL#${playlistId}#${index + 1}`,
    title: item.title.trim(),
    url: item.url.trim(),
    durationSec: Math.max(1, Number(item.durationSec || 0)),
    sourceType: item.sourceType || inferSourceType(item.url),
    mediaType: item.mediaType || inferMediaType(item.url),
  }));

  const totalDurationSec = normalizedItems.reduce(
    (sum, item) => sum + item.durationSec,
    0
  );

  await putItem(PLAYLIST_TABLE_NAME, {
    PK: pk,
    SK: "META",
    playlistId,
    name: input.name.trim(),
    status: "draft",
    itemCount: normalizedItems.length,
    totalDurationSec,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];

    await putItem(PLAYLIST_TABLE_NAME, {
      PK: pk,
      SK: `ITEM#${String(index + 1).padStart(4, "0")}`,
      playlistId,
      order: index + 1,
      assetPk: item.assetPk,
      title: item.title,
      sourceType: item.sourceType,
      mediaType: item.mediaType,
      url: item.url,
      durationSec: item.durationSec,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    playlistId,
    name: input.name.trim(),
    itemCount: normalizedItems.length,
    totalDurationSec,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: normalizedItems,
  };
}