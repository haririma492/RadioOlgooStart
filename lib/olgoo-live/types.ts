export type OlgooChannelId = "OLGOO_LIVE" | string;

export type PlaylistItem = {
  assetPk?: string;
  title: string;
  url: string;
  durationSec: number;
  sourceType?: string;
  mediaType?: string;
};

export type PlaylistMeta = {
  playlistId: string;
  name: string;
  itemCount: number;
  totalDurationSec: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PlaylistRecord = PlaylistMeta & {
  items: PlaylistItem[];
};

export type ScheduleBlock = {
  order: number;
  blockType: "playlist" | "item";
  refId: string;
  title: string;
  durationSec: number;
  url?: string;
};

export type ScheduleMeta = {
  scheduleId: string;
  name: string;
  channelId: string;
  status: "draft" | "active";
  blockCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ScheduleRecord = ScheduleMeta & {
  blocks: ScheduleBlock[];
};
