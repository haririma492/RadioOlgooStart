import { fetchChannelState, fetchRuntimeRows } from "./schedules";

export async function resolveNowPlaying(channelId: string) {
  const rows = await fetchRuntimeRows(channelId);
  const now = Date.now();

  let current: any = null;
  const upcoming: any[] = [];

  for (const row of rows) {
    const startTs = row.startTs ? Date.parse(String(row.startTs)) : NaN;
    const endTs = row.endTs ? Date.parse(String(row.endTs)) : NaN;

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) continue;

    if (startTs <= now && now < endTs) {
      current = row;
    } else if (startTs >= now) {
      upcoming.push(row);
    }
  }

  upcoming.sort((a, b) => String(a.startTs || "").localeCompare(String(b.startTs || "")));

  return {
    state: await fetchChannelState(channelId),
    nowPlaying: current,
    upcoming: upcoming.slice(0, 5),
  };
}
