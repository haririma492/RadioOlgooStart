import {
  PLAYLIST_TABLE_NAME,
  SCHEDULE_TABLE_NAME,
  getPlaybackState,
  queryByPk,
  scanTable,
  setPlaybackState,
  tableExists,
} from "./dynamo";

function normalizeScheduleId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function resolveScheduleIdentifier(scheduleIdentifier: string) {
  const exists = await tableExists(SCHEDULE_TABLE_NAME);
  if (!exists) {
    throw new Error(`Schedule table ${SCHEDULE_TABLE_NAME} does not exist.`);
  }

  const allRows = await scanTable(SCHEDULE_TABLE_NAME, 5000);
  const metas = allRows.filter(
    (row) => row.SK === "META" && String(row.PK || "").startsWith("SCHEDULE#")
  );

  const normalizedWanted = normalizeScheduleId(scheduleIdentifier);

  const meta =
    metas.find((row) => String(row.scheduleId || "") === scheduleIdentifier) ||
    metas.find((row) => String(row.name || "") === scheduleIdentifier) ||
    metas.find((row) => normalizeScheduleId(String(row.name || "")) === normalizedWanted) ||
    metas.find((row) => normalizeScheduleId(String(row.scheduleId || "")) === normalizedWanted);

  if (!meta) {
    throw new Error(`Could not find schedule "${scheduleIdentifier}".`);
  }

  return {
    scheduleId: String(meta.scheduleId || "").trim(),
    name: String(meta.name || meta.scheduleId || "").trim(),
    pk: String(meta.PK || "").trim(),
  };
}

async function resolveFirstPlayableFromSchedule(scheduleIdentifier: string) {
  const schedule = await resolveScheduleIdentifier(scheduleIdentifier);
  const scheduleRows = await queryByPk(SCHEDULE_TABLE_NAME, schedule.pk);

  const blocks = scheduleRows
    .filter((row) => String(row.SK || "").startsWith("BLOCK#"))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  if (!blocks.length) {
    throw new Error(`Schedule "${schedule.name}" has no blocks.`);
  }

  const firstBlock = blocks[0];
  const playlistId = String(firstBlock.refId || "").trim();

  if (!playlistId) {
    throw new Error(`Schedule "${schedule.name}" block has no playlist refId.`);
  }

  const playlistPk = `PLAYLIST#${playlistId}`;
  const playlistRows = await queryByPk(PLAYLIST_TABLE_NAME, playlistPk);

  const items = playlistRows
    .filter((row) => String(row.SK || "").startsWith("ITEM#"))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  if (!items.length) {
    throw new Error(`Playlist "${playlistId}" has no items.`);
  }

  const firstItem = items[0];
  const mediaUrl = String(firstItem.url || "").trim();
  const title = String(firstItem.title || schedule.name || "Olgoo Live").trim();

  if (!mediaUrl) {
    throw new Error(`Playlist "${playlistId}" first item has no media URL.`);
  }

  return {
    mediaUrl,
    title,
    sourceScheduleId: schedule.scheduleId,
    sourcePlaylistId: playlistId,
  };
}

export async function startPlayback(mediaUrl: string, title: string) {
  return await setPlaybackState({
    playState: "playing",
    mediaUrl,
    title,
    startedAt: new Date().toISOString(),
  });
}

export async function startPlaybackFromSchedule(scheduleIdentifier: string) {
  const resolved = await resolveFirstPlayableFromSchedule(scheduleIdentifier);

  return await setPlaybackState({
    playState: "playing",
    mediaUrl: resolved.mediaUrl,
    title: resolved.title,
    startedAt: new Date().toISOString(),
    sourceScheduleId: resolved.sourceScheduleId,
    sourcePlaylistId: resolved.sourcePlaylistId,
  });
}

export async function stopPlayback() {
  return await setPlaybackState({
    playState: "stopped",
  });
}

export async function currentPlayback() {
  return await getPlaybackState();
}