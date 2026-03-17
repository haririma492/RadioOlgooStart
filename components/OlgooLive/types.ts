export type OlgooLivePlayerType = "video" | "iframe";

export type PlaybackState = {
  mode: "schedule" | "manual";
  scheduleId?: string;
  startedAt: string;
  updatedAt?: string;
  active?: boolean;
};

export type PlaylistItem = {
  id: string;
  title?: string;
  url: string;
  durationSec?: number;
  playerType?: OlgooLivePlayerType;
};

export type Playlist = {
  id: string;
  title?: string;
  items: PlaylistItem[];
};

export type ScheduleBlock = {
  playlistId: string;
};

export type Schedule = {
  id: string;
  title?: string;
  active?: boolean;
  blocks?: ScheduleBlock[];
};

export type CanonicalPlaybackItem = {
  itemId: string;
  title: string;
  url: string;
  playerType: OlgooLivePlayerType;
  startedAt: string;
  offsetSec: number;
  playToken: string;
  canPlay: boolean;
  playState: "playing" | "stopped" | "paused";
};