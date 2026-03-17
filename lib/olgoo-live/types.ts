export type OlgooChannelId = "OLGOO_LIVE" | string;

export type OlgooLivePlayerType = "video" | "iframe";

export type OlgooLiveState = {
  ok: boolean;
  configured: boolean;
  playState: "playing" | "stopped" | "paused";
  title?: string;
  subtitle?: string;
  mediaUrl?: string;
  playerType?: OlgooLivePlayerType;
  playToken?: string;
  startedAt?: string;
  isLive?: boolean;
  posterUrl?: string;
  message?: string;
  source?: string;
  updatedAt?: string;
  canPlay?: boolean;
  clickable?: boolean;
  offsetSec?: number;
  currentItem?: CanonicalPlaybackItem | null;
};

export type PlaylistItem = {
  assetPk?: string;
  id?: string;
  title: string;
  url: string;
  durationSec: number;
  sourceType?: string;
  mediaType?: string;
  playerType?: OlgooLivePlayerType;
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

export type Playlist = PlaylistRecord;

export type ScheduleBlock = {
  order: number;
  blockType: "playlist" | "item";
  refId: string;
  title: string;
  durationSec: number;
  url?: string;
  playlistId?: string;
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

export type Schedule = ScheduleRecord;

export type PlaybackState = {
  mode: "schedule" | "manual";
  scheduleId?: string;
  startedAt: string;
  updatedAt?: string;
  active?: boolean;
  mediaUrl?: string;
  title?: string;
  playerType?: OlgooLivePlayerType;
};

export type CanonicalPlaybackItem = {
  itemIndex?: number;
  itemId?: string;
  title: string;
  url: string;
  durationSec: number;
  sourceType?: string;
  mediaType?: string;
  playerType?: OlgooLivePlayerType;
  startedAt?: string;
  itemStartedAt?: string;
  offsetSec?: number;
  playToken?: string;
  canPlay?: boolean;
  playState?: "playing" | "stopped" | "paused";
};