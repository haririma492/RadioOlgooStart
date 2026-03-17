Patch contents:
- app/api/olgoo-live/state/route.ts
- components/HeroSection/HeroSection.tsx
- components/OlgooLive/types.ts
- lib/olgoo-live/types.ts

What this patch changes:
- adds a 7-second listener heartbeat against /api/olgoo-live/state while Olgoo Live is open
- stops listener playback when operator stops/deactivates the schedule
- switches listener playback when operator changes to a different broadcast item or schedule
- keeps live-state requests non-cacheable
- starts broadcast audio unmuted by default when user clicks play
- keeps mute and close available

Apply at project root and then run:
- npm run build
