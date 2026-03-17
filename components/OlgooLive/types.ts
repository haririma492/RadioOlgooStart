export type OlgooLivePlayerType = "video" | "audio" | "image" | "iframe";

export type CanonicalOlgooLiveItem = {
  itemIndex: number;
  title: string;
  url: string;
  durationSec: number;
  sourceType?: string;
  mediaType?: string;
  itemStartedAt?: string;
  versionToken?: string;
};

export type OlgooLiveState = {
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
  currentItem?: CanonicalOlgooLiveItem | null;
  sourceScheduleId?: string;
  sourcePlaylistId?: string;
  message?: string;
  cachePolicy?: "no-store";
  versionToken?: string;
};
