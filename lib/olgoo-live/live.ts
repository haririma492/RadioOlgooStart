import { getPlaybackState } from "./dynamo";

export async function resolveNowPlaying(channelId: string) {
  const playbackState = await getPlaybackState();

  return {
    state: {
      channelId,
      playState: playbackState.playState,
      mediaUrl: playbackState.mediaUrl,
      title: playbackState.title,
      startedAt: playbackState.startedAt,
      updatedAt: playbackState.updatedAt,
      sourceScheduleId: playbackState.sourceScheduleId,
      sourcePlaylistId: playbackState.sourcePlaylistId,
    },
    nowPlaying:
      playbackState.playState === "playing"
        ? {
            title: playbackState.title || "",
            url: playbackState.mediaUrl || "",
            startedAt: playbackState.startedAt,
            updatedAt: playbackState.updatedAt,
            sourceScheduleId: playbackState.sourceScheduleId,
            sourcePlaylistId: playbackState.sourcePlaylistId,
          }
        : null,
    upcoming: [],
  };
}