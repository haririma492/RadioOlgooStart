This patch is a PHASE-1 React/TypeScript shell for the old Streamlit support console.

It adds:
- /TVsupport page with tabs:
  - Playlist
  - Schedule
  - Subtitles
  - Live
  - Admin / Backfill
- reusable components under components/TVsupport/*
- initial TypeScript backend modules under lib/olgoo-live/*
- overview and live status API routes

This patch DOES NOT yet port all Streamlit functionality.
It gives the correct top-level structure so the rest can be migrated tab-by-tab.

Environment variables to add to .env.local:

RADIO_OLGOO_SLIDES_TABLE=RadioOlgooSlides
RADIO_OLGOO_PLAYLISTS_TABLE=RadioOlgooPlaylists
RADIO_OLGOO_SCHEDULES_TABLE=RadioOlgooSchedules
RADIO_OLGOO_CHANNEL_STATE_TABLE=RadioOlgooChannelState
RADIO_OLGOO_SUBTITLES_TABLE=RadioOlgooSubtitles
AWS_REGION=ca-central-1
