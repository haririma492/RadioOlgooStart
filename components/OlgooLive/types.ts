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
};
