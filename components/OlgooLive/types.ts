export type OlgooLivePlayerType = "video" | "iframe";

export type OlgooLiveCurrentItem = {
  title: string;
  url: string;
  durationSec: number;
  mediaType?: string;
  sourceType?: string;
};

export type OlgooLiveState = {
  ok: boolean;
  configured: boolean;
  isConfigured?: boolean;
  playState: "playing" | "stopped" | "paused";
  title?: string;
  mediaUrl?: string;
  playerType?: OlgooLivePlayerType;
  playToken?: string;
  startedAt?: string;
  updatedAt?: string;
  isLive?: boolean;
  canPlay?: boolean;
  clickable?: boolean;
  status?: string;
  currentItem?: OlgooLiveCurrentItem | null;
  offsetSec?: number;
  url?: string;
  streamUrl?: string;
  playbackUrl?: string;
};
