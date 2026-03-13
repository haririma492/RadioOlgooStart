This patch implements the first real functional TVsupport tab: Playlist.

It adds:
- RadioOlgooSlides content library fetch
- active media preview cards
- Add button to build playlist
- Move Up / Move Down / Remove for selected items
- Save playlist to RadioOlgooPlaylists
- list saved playlists

Files included:
- components/TVsupport/MediaPreview.tsx
- components/TVsupport/PlaylistTab.tsx
- lib/olgoo-live/slides.ts
- app/api/olgoo-live/slides/route.ts
- app/api/olgoo-live/playlists/route.ts

Required env vars already discussed:
RADIO_OLGOO_SLIDES_TABLE=RadioOlgooSlides
RADIO_OLGOO_PLAYLISTS_TABLE=RadioOlgooPlaylists
AWS_REGION=ca-central-1
