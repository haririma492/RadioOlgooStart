export type OlgooChannelId = "OLGOO_LIVE" | string;
export type OlgooLivePlayerType = "video" | "audio" | "image" | "iframe";

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

export type CanonicalPlaybackItem = PlaylistItem & {
  itemIndex: number;
  itemStartedAt?: string;
  versionToken?: string;
};

export type CanonicalLiveState = {
  ok: boolean;
  configured: boolean;
  canPlay: boolean;
  isLive: boolean;
  playState: "playing" | "stopped";
  serverNow: string;
  startedAt?: string;
  updatedAt?: string;
  title?: string;
  mediaUrl?: string;
  playerType?: OlgooLivePlayerType;
  offsetSec: number;
  currentItem?: CanonicalPlaybackItem | null;
  sourceScheduleId?: string;
  sourcePlaylistId?: string;
  message?: string;
  cachePolicy?: "no-store";
  versionToken?: string;
};
