import {
  SCHEDULE_TABLE_NAME,
  deleteItem,
  ensurePkSkTable,
  nowIso,
  queryByPk,
  scanTable,
  slugifyName,
  putItem,
} from "./dynamo";
import type { ScheduleBlock, ScheduleMeta, ScheduleRecord } from "./types";

export async function listSchedules(): Promise<ScheduleMeta[]> {
  await ensurePkSkTable(SCHEDULE_TABLE_NAME);
  const rows = await scanTable(SCHEDULE_TABLE_NAME, 5000);

  return rows
    .filter((row) => row.SK === "META" && String(row.PK || "").startsWith("SCHEDULE#"))
    .map(
      (row) =>
        ({
          scheduleId: String(row.scheduleId || ""),
          name: String(row.name || row.scheduleId || ""),
          channelId: String(row.channelId || "OLGOO_LIVE"),
          status: String(row.status || "draft") === "active" ? "active" : "draft",
          blockCount: Number(row.blockCount || 0),
          createdAt: row.createdAt ? String(row.createdAt) : undefined,
          updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
        }) satisfies ScheduleMeta
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSchedule(scheduleId: string): Promise<ScheduleRecord | null> {
  await ensurePkSkTable(SCHEDULE_TABLE_NAME);
  const rows = await queryByPk(SCHEDULE_TABLE_NAME, `SCHEDULE#${scheduleId}`);
  if (!rows.length) return null;

  const meta = rows.find((row) => row.SK === "META");
  const blocks = rows
    .filter((row) => String(row.SK || "").startsWith("BLOCK#"))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map(
      (row) =>
        ({
          order: Number(row.order || 0),
          blockType: String(row.blockType || "playlist") === "item" ? "item" : "playlist",
          refId: String(row.refId || ""),
          title: String(row.title || ""),
          durationSec: Number(row.durationSec || 0),
          url: row.url ? String(row.url) : undefined,
        }) satisfies ScheduleBlock
    );

  return {
    scheduleId,
    name: String(meta?.name || scheduleId),
    channelId: String(meta?.channelId || "OLGOO_LIVE"),
    status: String(meta?.status || "draft") === "active" ? "active" : "draft",
    blockCount: Number(meta?.blockCount || blocks.length),
    createdAt: meta?.createdAt ? String(meta.createdAt) : undefined,
    updatedAt: meta?.updatedAt ? String(meta.updatedAt) : undefined,
    blocks,
  };
}

export async function saveSchedule(input: {
  name: string;
  channelId: string;
  blocks: ScheduleBlock[];
  active?: boolean;
}): Promise<ScheduleRecord> {
  await ensurePkSkTable(SCHEDULE_TABLE_NAME);

  const scheduleId = slugifyName(input.name);
  const pk = `SCHEDULE#${scheduleId}`;
  const existing = await queryByPk(SCHEDULE_TABLE_NAME, pk);

  for (const row of existing) {
    await deleteItem(SCHEDULE_TABLE_NAME, { PK: pk, SK: row.SK });
  }

  const timestamp = nowIso();
  const normalizedBlocks = input.blocks.map(
    (block, index) =>
      ({
        order: index + 1,
        blockType: block.blockType === "item" ? "item" : "playlist",
        refId: block.refId.trim(),
        title: block.title.trim(),
        durationSec: Math.max(1, Number(block.durationSec || 0)),
        url: block.url?.trim() || undefined,
      }) satisfies ScheduleBlock
  );

  await putItem(SCHEDULE_TABLE_NAME, {
    PK: pk,
    SK: "META",
    scheduleId,
    name: input.name.trim(),
    channelId: input.channelId || "OLGOO_LIVE",
    status: input.active ? "active" : "draft",
    blockCount: normalizedBlocks.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  for (const block of normalizedBlocks) {
    await putItem(SCHEDULE_TABLE_NAME, {
      PK: pk,
      SK: `BLOCK#${String(block.order).padStart(4, "0")}`,
      scheduleId,
      order: block.order,
      blockType: block.blockType,
      refId: block.refId,
      title: block.title,
      durationSec: block.durationSec,
      url: block.url,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    scheduleId,
    name: input.name.trim(),
    channelId: input.channelId || "OLGOO_LIVE",
    status: input.active ? "active" : "draft",
    blockCount: normalizedBlocks.length,
    createdAt: timestamp,
    updatedAt: timestamp,
    blocks: normalizedBlocks,
  };
}