export const TABLES = {
  slides: process.env.RADIO_OLGOO_SLIDES_TABLE || "RadioOlgooSlides",
  playlists: process.env.RADIO_OLGOO_PLAYLISTS_TABLE || "RadioOlgooPlaylists",
  schedules: process.env.RADIO_OLGOO_SCHEDULES_TABLE || "RadioOlgooSchedules",
  channelState: process.env.RADIO_OLGOO_CHANNEL_STATE_TABLE || "RadioOlgooChannelState",
  subtitles: process.env.RADIO_OLGOO_SUBTITLES_TABLE || "RadioOlgooSubtitles",
};

export const DEFAULT_REGION = process.env.AWS_REGION || "ca-central-1";
